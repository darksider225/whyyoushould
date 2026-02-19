(function () {
  function getMeta(name) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? (el.getAttribute("content") || "").trim() : "";
  }

  function normalizeBasePath(path) {
    if (!path || path === "/") return "/";
    return `/${path.replace(/^\/+|\/+$/g, "")}/`;
  }

  const authView = document.body.dataset.authView || "";
  const basePath = normalizeBasePath(getMeta("wys-base-path"));
  const supabaseUrl = getMeta("supabase-url");
  const supabaseAnonKey = getMeta("supabase-anon-key");

  const withBase = (path) => {
    const clean = path.startsWith("/") ? path.slice(1) : path;
    if (basePath === "/") return `/${clean}`;
    return `${basePath}${clean}`;
  };

  const absoluteUrl = (path) => new URL(withBase(path), window.location.origin).toString();

  function setStatus(id, message, kind) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || "";
    el.classList.remove("status-success", "status-error", "status-info");
    if (kind) el.classList.add(`status-${kind}`);
  }

  function setNav(user) {
    const link = document.getElementById("nav-auth-link");
    if (!link) return;
    if (user) {
      link.textContent = "Account";
      link.href = withBase("/account/");
    } else {
      link.textContent = "Sign In";
      link.href = withBase("/auth/login/");
    }
  }

  if (!authView) return;

  if (!supabaseUrl || !supabaseAnonKey || !window.supabase) {
    const targetStatus =
      authView === "reset" ? "reset-status" : authView === "callback" ? "callback-status" : "auth-status";
    setStatus(
      targetStatus,
      "Auth is not configured yet. Add SUPABASE_URL and SUPABASE_ANON_KEY at build time.",
      "error"
    );
    return;
  }

  const client = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  client.auth.getSession().then(({ data }) => setNav(data.session?.user || null));
  client.auth.onAuthStateChange((_event, session) => setNav(session?.user || null));

  async function handleSignup(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = form.email.value.trim();
    const password = form.password.value;

    setStatus("auth-status", "Creating account...", "info");
    const { error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: absoluteUrl("/auth/callback/"),
      },
    });

    if (error) {
      setStatus("auth-status", error.message, "error");
      return;
    }
    setStatus("auth-status", "Account created. Check your email to verify your account.", "success");
    form.reset();
  }

  async function handleLogin(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = form.email.value.trim();
    const password = form.password.value;

    setStatus("auth-status", "Signing in...", "info");
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus("auth-status", error.message, "error");
      return;
    }
    window.location.href = withBase("/account/");
  }

  async function handleForgot(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = form.email.value.trim();
    setStatus("auth-status", "Sending recovery email...", "info");
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: absoluteUrl("/auth/reset/"),
    });
    if (error) {
      setStatus("auth-status", error.message, "error");
      return;
    }
    setStatus("auth-status", "Recovery email sent. Check your inbox.", "success");
    form.reset();
  }

  async function handleGoogle() {
    setStatus("auth-status", "Redirecting to Google...", "info");
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: absoluteUrl("/auth/callback/"),
      },
    });
    if (error) setStatus("auth-status", error.message, "error");
  }

  async function initAuthPage() {
    document.getElementById("signup-form")?.addEventListener("submit", handleSignup);
    document.getElementById("login-form")?.addEventListener("submit", handleLogin);
    document.getElementById("forgot-form")?.addEventListener("submit", handleForgot);
    document.getElementById("google-signin-btn")?.addEventListener("click", handleGoogle);

    const { data } = await client.auth.getSession();
    if (data.session?.user) {
      setStatus("auth-status", "You are already signed in.", "success");
    }
  }

  async function initAccountPage() {
    const loading = document.getElementById("account-loading");
    const guest = document.getElementById("account-guest");
    const userPanel = document.getElementById("account-user");
    const emailEl = document.getElementById("account-email");
    const signOutBtn = document.getElementById("signout-btn");

    const update = (user) => {
      if (loading) loading.hidden = true;
      if (user) {
        if (guest) guest.hidden = true;
        if (userPanel) userPanel.hidden = false;
        if (emailEl) emailEl.textContent = user.email || "";
        setStatus("account-status", "Signed in successfully.", "success");
      } else {
        if (userPanel) userPanel.hidden = true;
        if (guest) guest.hidden = false;
        setStatus("account-status", "You are not signed in.", "info");
      }
    };

    const { data } = await client.auth.getSession();
    update(data.session?.user || null);
    client.auth.onAuthStateChange((_event, session) => update(session?.user || null));

    signOutBtn?.addEventListener("click", async () => {
      setStatus("account-status", "Signing out...", "info");
      await client.auth.signOut();
      window.location.href = withBase("/auth/login/");
    });
  }

  async function initCallbackPage() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error_description")) {
      setStatus("callback-status", decodeURIComponent(params.get("error_description")), "error");
      return;
    }

    setStatus("callback-status", "Finalizing your sign in...", "info");
    const { data } = await client.auth.getSession();
    if (data.session?.user) {
      window.location.replace(withBase("/account/"));
      return;
    }

    setTimeout(async () => {
      const result = await client.auth.getSession();
      if (result.data.session?.user) {
        window.location.replace(withBase("/account/"));
      } else {
        setStatus("callback-status", "Could not establish session. Please try signing in again.", "error");
      }
    }, 1200);
  }

  async function initResetPage() {
    const form = document.getElementById("reset-form");
    const { data } = await client.auth.getSession();
    if (!data.session?.user) {
      setStatus("reset-status", "Invalid or expired recovery link. Request a new one.", "error");
      return;
    }

    setStatus("reset-status", "Recovery session detected. Set your new password.", "info");
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = form.password.value;
      const confirmPassword = form.confirmPassword.value;

      if (password !== confirmPassword) {
        setStatus("reset-status", "Passwords do not match.", "error");
        return;
      }
      if (password.length < 8) {
        setStatus("reset-status", "Password must be at least 8 characters.", "error");
        return;
      }

      setStatus("reset-status", "Updating password...", "info");
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        setStatus("reset-status", error.message, "error");
        return;
      }
      setStatus("reset-status", "Password updated. Redirecting to account...", "success");
      setTimeout(() => {
        window.location.href = withBase("/account/");
      }, 900);
    });
  }

  if (authView === "auth" || authView === "login" || authView === "signup" || authView === "forgot") {
    initAuthPage();
  }
  if (authView === "account") initAccountPage();
  if (authView === "callback") initCallbackPage();
  if (authView === "reset") initResetPage();
})();
