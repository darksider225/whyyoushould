(function () {
  function getMeta(name) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? (el.getAttribute("content") || "").trim() : "";
  }

  function normalizeBasePath(path) {
    if (!path || path === "/") return "/";
    return `/${path.replace(/^\/+|\/+$/g, "")}/`;
  }

  const basePath = normalizeBasePath(getMeta("wys-base-path"));
  const supabaseUrl = getMeta("supabase-url");
  const supabaseAnonKey = getMeta("supabase-anon-key");

  const withBase = (path) => {
    const clean = path.startsWith("/") ? path.slice(1) : path;
    return basePath === "/" ? `/${clean}` : `${basePath}${clean}`;
  };

  const reviewRoot = document.querySelector(".review-interactions");
  const favoritesRoot = document.querySelector("[data-favorites-view]");
  if (!reviewRoot && !favoritesRoot) return;

  function setStatus(id, message, kind) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || "";
    el.classList.remove("status-success", "status-error", "status-info");
    if (kind) el.classList.add(`status-${kind}`);
  }

  let favoriteToastTimer = null;
  function showFavoriteToast(message, kind) {
    const el = document.getElementById("favorite-status");
    if (!el) return;
    el.textContent = message || "";
    el.classList.remove("status-success", "status-error", "status-info", "is-visible");
    if (kind) el.classList.add(`status-${kind}`);
    if (!message) return;
    void el.offsetWidth;
    el.classList.add("is-visible");
    if (favoriteToastTimer) window.clearTimeout(favoriteToastTimer);
    favoriteToastTimer = window.setTimeout(() => {
      el.classList.remove("is-visible");
    }, 2600);
  }

  function setNav(user) {
    const links = [
      document.getElementById("nav-auth-link"),
      document.getElementById("nav-auth-link-menu"),
      document.getElementById("nav-auth-link-mobile"),
    ].filter(Boolean);
    if (links.length === 0) return;

    if (user) {
      links.forEach((link) => {
        link.textContent = "Account";
        link.href = withBase("/account/");
      });
      return;
    }

    links.forEach((link) => {
      link.textContent = "Sign In";
      link.href = withBase("/auth/login/");
    });
  }

  function escapeHtml(input) {
    return String(input || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(dateString) {
    try {
      return new Date(dateString).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_e) {
      return "";
    }
  }

  function parseVideoIdList(csv) {
    if (!csv) return [];
    return Array.from(
      new Set(
        String(csv)
          .split(",")
          .map((part) => part.trim())
          .filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id))
      )
    );
  }

  function getYouTubeVideoIdFromUrl(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url, window.location.origin);
      const host = parsed.hostname.toLowerCase();
      if (host === "youtu.be") return parsed.pathname.slice(1);
      if (host.endsWith("youtube.com")) {
        if (parsed.pathname === "/watch") return parsed.searchParams.get("v") || "";
        if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/")[2] || "";
        if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2] || "";
      }
      return "";
    } catch (_err) {
      return "";
    }
  }

  function buildYouTubeEmbedUrl(videoId) {
    const url = new URL(`https://www.youtube.com/embed/${videoId}`);
    url.searchParams.set("rel", "0");
    url.searchParams.set("modestbranding", "1");
    url.searchParams.set("enablejsapi", "1");
    url.searchParams.set("playsinline", "1");
    return url.toString();
  }

  let youtubeIframeApiPromise = null;
  function loadYouTubeIframeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (youtubeIframeApiPromise) return youtubeIframeApiPromise;

    youtubeIframeApiPromise = new Promise((resolve) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof previousReady === "function") {
          previousReady();
        }
        resolve(window.YT || null);
      };

      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (existing) return;

      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });

    return youtubeIframeApiPromise;
  }

  async function initTrailerFallback() {
    const trailerCard = document.querySelector(".review-trailer-card[data-trailer-candidate-ids]");
    const iframe = document.getElementById("review-trailer-iframe");
    if (!trailerCard || !iframe) return;

    const openLink = document.getElementById("open-trailer-link");
    const status = document.getElementById("review-trailer-status");
    const csvIds = trailerCard.dataset.trailerCandidateIds || "";
    const embedId = getYouTubeVideoIdFromUrl(iframe.getAttribute("src") || "");
    const candidateIds = parseVideoIdList([embedId, csvIds].filter(Boolean).join(","));
    if (candidateIds.length === 0) return;

    let activeIndex = 0;
    let hasSwitched = false;

    const setStatus = (message) => {
      if (!status) return;
      status.textContent = message || "";
      status.classList.remove("status-info");
      if (message) status.classList.add("status-info");
    };

    const setOpenLink = (videoId) => {
      if (!openLink || !videoId) return;
      openLink.href = `https://www.youtube.com/watch?v=${videoId}`;
    };

    const yt = await loadYouTubeIframeApi();
    if (!yt?.Player || candidateIds.length < 2) {
      setOpenLink(candidateIds[0]);
      return;
    }

    iframe.src = buildYouTubeEmbedUrl(candidateIds[activeIndex]);
    setOpenLink(candidateIds[activeIndex]);

    const restrictedErrors = new Set([100, 101, 150]);

    const player = new yt.Player("review-trailer-iframe", {
      events: {
        onReady: () => {
          setOpenLink(candidateIds[activeIndex]);
        },
        onError: (event) => {
          if (!restrictedErrors.has(Number(event?.data))) return;

          const nextIndex = activeIndex + 1;
          if (nextIndex >= candidateIds.length) {
            setStatus("This trailer is unavailable in your country. Use Search on YouTube for alternatives.");
            return;
          }

          activeIndex = nextIndex;
          const nextId = candidateIds[activeIndex];
          setOpenLink(nextId);
          player.loadVideoById(nextId);
          if (!hasSwitched) {
            hasSwitched = true;
            setStatus("Switched to an alternate trailer available in your region.");
          }
        },
      },
    });
  }

  function normalizeRatingValue(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const rounded = Math.round(n);
    if (rounded < 1 || rounded > 10) return null;
    return rounded;
  }

  function paintRatingChoice(value) {
    const normalized = normalizeRatingValue(value);
    const input = document.getElementById("user-rating-input");
    const choices = Array.from(document.querySelectorAll(".rating-choice"));
    if (!input || choices.length === 0) return;

    if (!normalized) {
      input.value = "";
      choices.forEach((choice) => {
        choice.classList.remove("is-filled");
        choice.classList.remove("is-active");
        choice.setAttribute("aria-checked", "false");
      });
      return;
    }

    input.value = String(normalized);
    choices.forEach((choice) => {
      const value = Number(choice.dataset.value);
      const isActive = value === normalized;
      const isFilled = value <= normalized;
      choice.classList.toggle("is-active", isActive);
      choice.classList.toggle("is-filled", isFilled);
      choice.setAttribute("aria-checked", isActive ? "true" : "false");
    });
  }

  function bindRatingPicker() {
    const choices = Array.from(document.querySelectorAll(".rating-choice"));
    if (choices.length === 0) return;
    choices.forEach((choice) => {
      choice.addEventListener("click", () => {
        paintRatingChoice(choice.dataset.value);
      });
    });
  }

  function userLabel(userId) {
    if (!userId) return "User";
    if (currentUser && currentUser.id === userId) return "You";
    return `User ${String(userId).slice(0, 6)}`;
  }

  if (reviewRoot) {
    initTrailerFallback();
  }

  if (!supabaseUrl || !supabaseAnonKey || !window.supabase) {
    setStatus("favorite-status", "Audience features are not configured yet.", "error");
    setStatus("user-rating-status", "Audience features are not configured yet.", "error");
    setStatus("review-comment-status", "Audience features are not configured yet.", "error");
    setStatus("community-post-status", "Audience features are not configured yet.", "error");
    setStatus("favorites-status", "Audience features are not configured yet.", "error");
    return;
  }

  const client = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  let currentUser = null;
  let currentRole = "user";

  async function hydrateSession() {
    const { data } = await client.auth.getSession();
    currentUser = data.session?.user || null;
    setNav(currentUser);

    currentRole = "user";
    if (currentUser) {
      const { data: profile } = await client.from("profiles").select("role").eq("id", currentUser.id).maybeSingle();
      currentRole = profile?.role || "user";
    }
  }

  function canModerate(userId) {
    if (!currentUser) return false;
    return currentUser.id === userId || currentRole === "owner";
  }

  async function upsertProfileIfNeeded() {
    if (!currentUser) return;
    const displayName = (currentUser.email || "").split("@")[0] || "User";
    await client.from("profiles").upsert(
      {
        id: currentUser.id,
        display_name: displayName,
      },
      { onConflict: "id" }
    );
  }

  function bindTabs() {
    const tabOriginal = document.getElementById("tab-original");
    const tabCommunity = document.getElementById("tab-community");
    const panelOriginal = document.getElementById("panel-original");
    const panelCommunity = document.getElementById("panel-community");
    if (!tabOriginal || !tabCommunity || !panelOriginal || !panelCommunity) return;

    const activate = (target) => {
      const isOriginal = target === "original";
      tabOriginal.classList.toggle("is-active", isOriginal);
      tabCommunity.classList.toggle("is-active", !isOriginal);
      tabOriginal.setAttribute("aria-selected", isOriginal ? "true" : "false");
      tabCommunity.setAttribute("aria-selected", isOriginal ? "false" : "true");
      panelOriginal.classList.toggle("is-active", isOriginal);
      panelCommunity.classList.toggle("is-active", !isOriginal);
      panelOriginal.hidden = !isOriginal;
      panelCommunity.hidden = isOriginal;
    };

    tabOriginal.addEventListener("click", () => activate("original"));
    tabCommunity.addEventListener("click", () => activate("community"));
  }

  async function initFavoritesPage() {
    const list = document.getElementById("favorites-list");
    if (!list) return;

    if (!currentUser) {
      setStatus("favorites-status", "Sign in to view and manage your favorites.", "info");
      list.innerHTML = `<a class="btn-primary" href="${withBase("/auth/login/")}">Sign In</a>`;
      return;
    }

    setStatus("favorites-status", "Loading favorites...", "info");
    const { data, error } = await client
      .from("favorites")
      .select("id, review_slug, created_at")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) {
      setStatus("favorites-status", error.message, "error");
      return;
    }

    if (!data || data.length === 0) {
      setStatus("favorites-status", "No favorites yet. Add some from review pages.", "info");
      list.innerHTML = "";
      return;
    }

    setStatus("favorites-status", `${data.length} favorite review(s).`, "success");
    list.innerHTML = data
      .map((item) => {
        const title = item.review_slug
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        return `
          <article class="favorite-item">
            <div>
              <h2><a href="${withBase(`/reviews/${encodeURIComponent(item.review_slug)}/`)}">${escapeHtml(title)}</a></h2>
              <p class="favorite-meta">Saved on ${escapeHtml(formatDate(item.created_at))}</p>
            </div>
            <button class="btn-secondary favorite-remove-btn" data-favorite-id="${item.id}" type="button">Remove</button>
          </article>
        `;
      })
      .join("");

    Array.from(document.querySelectorAll(".favorite-remove-btn")).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.favoriteId || "0");
        if (!id) return;
        const { error: removeError } = await client.from("favorites").delete().eq("id", id).eq("user_id", currentUser.id);
        if (removeError) {
          setStatus("favorites-status", removeError.message, "error");
          return;
        }
        await initFavoritesPage();
      });
    });
  }

  async function initReviewFeatures() {
    const reviewSlug = reviewRoot?.dataset.reviewSlug;
    if (!reviewSlug) return;

    bindTabs();
    bindRatingPicker();
    await loadFavoriteState(reviewSlug);
    await loadCommunityRating(reviewSlug);
    await loadUserRating(reviewSlug);
    await loadReviewComments(reviewSlug);
    await loadCommunity(reviewSlug);

    const favoriteBtn = document.getElementById("favorite-toggle-btn");
    favoriteBtn?.addEventListener("click", async () => {
      if (!currentUser) {
        showFavoriteToast("Please sign in to add this review to your favorites.", "info");
        return;
      }
      const isFavorite = favoriteBtn.dataset.favorite === "true";
      if (isFavorite) {
        const { error } = await client.from("favorites").delete().eq("user_id", currentUser.id).eq("review_slug", reviewSlug);
        if (error) {
          showFavoriteToast(error.message, "error");
          return;
        }
        showFavoriteToast("Removed from favorites.", "success");
      } else {
        const { error } = await client.from("favorites").insert({ user_id: currentUser.id, review_slug: reviewSlug });
        if (error) {
          showFavoriteToast(error.message, "error");
          return;
        }
        showFavoriteToast("Added to favorites.", "success");
      }
      await loadFavoriteState(reviewSlug);
    });

    const ratingForm = document.getElementById("user-rating-form");
    ratingForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!currentUser) {
        setStatus("user-rating-status", "Sign in to submit your rating.", "info");
        return;
      }
      const input = document.getElementById("user-rating-input");
      const rating = normalizeRatingValue(input?.value || "");
      if (!rating) {
        setStatus("user-rating-status", "Rating must be between 1 and 10.", "error");
        return;
      }
      const { error } = await client.from("user_ratings").upsert(
        {
          user_id: currentUser.id,
          review_slug: reviewSlug,
          rating,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,review_slug" }
      );
      if (error) {
        setStatus("user-rating-status", error.message, "error");
        return;
      }
      setStatus("user-rating-status", "Rating saved.", "success");
      await loadCommunityRating(reviewSlug);
    });

    const reviewCommentForm = document.getElementById("review-comment-form");
    reviewCommentForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!currentUser) {
        setStatus("review-comment-status", "Sign in to post comments.", "info");
        return;
      }
      const input = document.getElementById("review-comment-input");
      const content = (input?.value || "").trim();
      if (!content) {
        setStatus("review-comment-status", "Write something before posting.", "error");
        return;
      }
      const { error } = await client.from("review_comments").insert({
        review_slug: reviewSlug,
        user_id: currentUser.id,
        content,
      });
      if (error) {
        setStatus("review-comment-status", error.message, "error");
        return;
      }
      if (input) input.value = "";
      setStatus("review-comment-status", "Comment posted.", "success");
      await loadReviewComments(reviewSlug);
    });

    const postForm = document.getElementById("community-post-form");
    const postDeleteBtn = document.getElementById("community-post-delete-btn");
    postForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!currentUser) {
        setStatus("community-post-status", "Sign in to post your audience take.", "info");
        return;
      }
      const input = document.getElementById("community-post-input");
      const content = (input?.value || "").trim();
      if (!content) {
        setStatus("community-post-status", "Write your community post before publishing.", "error");
        return;
      }
      const { error } = await client.from("community_posts").upsert(
        {
          review_slug: reviewSlug,
          user_id: currentUser.id,
          content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,review_slug" }
      );
      if (error) {
        setStatus("community-post-status", error.message, "error");
        return;
      }
      setStatus("community-post-status", "Audience take saved.", "success");
      await loadCommunity(reviewSlug);
    });

    postDeleteBtn?.addEventListener("click", async () => {
      if (!currentUser) return;
      const { error } = await client.from("community_posts").delete().eq("user_id", currentUser.id).eq("review_slug", reviewSlug);
      if (error) {
        setStatus("community-post-status", error.message, "error");
        return;
      }
      const input = document.getElementById("community-post-input");
      if (input) input.value = "";
      setStatus("community-post-status", "Audience take deleted.", "success");
      await loadCommunity(reviewSlug);
    });
  }

  async function loadFavoriteState(reviewSlug) {
    const btn = document.getElementById("favorite-toggle-btn");
    if (!btn) return;

    if (!currentUser) {
      btn.dataset.favorite = "false";
      btn.classList.remove("is-active");
      btn.setAttribute("aria-label", "Sign in to add this review to favorites");
      return;
    }
    const { data, error } = await client
      .from("favorites")
      .select("id")
      .eq("user_id", currentUser.id)
      .eq("review_slug", reviewSlug)
      .maybeSingle();
    if (error) {
      showFavoriteToast(error.message, "error");
      return;
    }
    const isFavorite = !!data;
    btn.dataset.favorite = isFavorite ? "true" : "false";
    btn.classList.toggle("is-active", isFavorite);
    btn.setAttribute("aria-label", isFavorite ? "Remove this review from favorites" : "Add this review to favorites");
  }

  async function loadUserRating(reviewSlug) {
    if (!currentUser) return;
    const input = document.getElementById("user-rating-input");
    if (!input) return;
    const { data, error } = await client
      .from("user_ratings")
      .select("rating")
      .eq("user_id", currentUser.id)
      .eq("review_slug", reviewSlug)
      .maybeSingle();
    if (!error && data?.rating) {
      paintRatingChoice(data.rating);
    } else {
      paintRatingChoice(null);
    }
  }

  async function loadCommunityRating(reviewSlug) {
    const scoreEl = document.getElementById("community-rating-value");
    const countEl = document.getElementById("community-rating-count");
    if (!scoreEl || !countEl) return;

    const { data, error } = await client.from("user_ratings").select("rating").eq("review_slug", reviewSlug);
    if (error) {
      scoreEl.textContent = "-";
      countEl.textContent = "";
      return;
    }
    const ratings = (data || []).map((item) => Number(item.rating)).filter((n) => Number.isFinite(n));
    if (ratings.length === 0) {
      scoreEl.textContent = "-";
      countEl.textContent = "(no user ratings yet)";
      return;
    }
    const avg = ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
    scoreEl.textContent = `${avg.toFixed(1)}/10`;
    countEl.textContent = `(${ratings.length} rating${ratings.length === 1 ? "" : "s"})`;
  }

  async function loadReviewComments(reviewSlug) {
    const list = document.getElementById("review-comments-list");
    if (!list) return;

    const { data, error } = await client
      .from("review_comments")
      .select("id, user_id, content, created_at")
      .eq("review_slug", reviewSlug)
      .order("created_at", { ascending: false });

    if (error) {
      list.innerHTML = `<p class="muted-text">${escapeHtml(error.message)}</p>`;
      return;
    }

    if (!data || data.length === 0) {
      list.innerHTML = `<p class="muted-text">No comments yet. Start the conversation.</p>`;
      return;
    }

    list.innerHTML = data
      .map((item) => {
        const author = userLabel(item.user_id);
        const controls = canModerate(item.user_id)
          ? `<div class="comment-controls">
              <button type="button" class="comment-edit-btn btn-secondary" data-id="${item.id}">Edit</button>
              <button type="button" class="comment-delete-btn btn-secondary" data-id="${item.id}">Delete</button>
            </div>`
          : "";
        return `<article class="comment-item">
          <div class="comment-head">
            <p><strong>${escapeHtml(author)}</strong></p>
            <p class="muted-text">${escapeHtml(formatDate(item.created_at))}</p>
          </div>
          <p>${escapeHtml(item.content)}</p>
          ${controls}
        </article>`;
      })
      .join("");

    Array.from(list.querySelectorAll(".comment-edit-btn")).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id || "0");
        const existing = data.find((item) => item.id === id);
        if (!existing) return;
        const updated = window.prompt("Edit comment", existing.content);
        if (!updated || !updated.trim()) return;
        const { error: updateError } = await client
          .from("review_comments")
          .update({ content: updated.trim(), updated_at: new Date().toISOString() })
          .eq("id", id);
        if (updateError) {
          setStatus("review-comment-status", updateError.message, "error");
          return;
        }
        await loadReviewComments(reviewSlug);
      });
    });

    Array.from(list.querySelectorAll(".comment-delete-btn")).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id || "0");
        if (!id) return;
        const { error: deleteError } = await client.from("review_comments").delete().eq("id", id);
        if (deleteError) {
          setStatus("review-comment-status", deleteError.message, "error");
          return;
        }
        await loadReviewComments(reviewSlug);
      });
    });
  }

  async function setReaction(postId, reaction) {
    if (!currentUser) {
      setStatus("community-post-status", "Sign in to react to audience takes.", "info");
      return;
    }
    const { data: existing } = await client
      .from("community_post_reactions")
      .select("id, reaction")
      .eq("post_id", postId)
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (existing?.reaction === reaction) {
      await client.from("community_post_reactions").delete().eq("id", existing.id);
      return;
    }

    await client.from("community_post_reactions").upsert(
      {
        post_id: postId,
        user_id: currentUser.id,
        reaction,
      },
      { onConflict: "post_id,user_id" }
    );
  }

  async function loadCommunity(reviewSlug) {
    const list = document.getElementById("community-posts-list");
    const myInput = document.getElementById("community-post-input");
    if (!list) return;

    const { data, error } = await client
      .from("community_posts")
      .select(
        "id, user_id, content, created_at, updated_at, community_post_reactions(id, user_id, reaction), community_post_comments(id, user_id, content, created_at)"
      )
      .eq("review_slug", reviewSlug)
      .order("updated_at", { ascending: false });

    if (error) {
      list.innerHTML = `<p class="muted-text">${escapeHtml(error.message)}</p>`;
      return;
    }

    const posts = data || [];
    const myPost = currentUser ? posts.find((post) => post.user_id === currentUser.id) : null;
    if (myInput) myInput.value = myPost?.content || "";

    if (posts.length === 0) {
      list.innerHTML = `<p class="muted-text">No community posts yet. Be the first one.</p>`;
      return;
    }

    list.innerHTML = posts
      .map((post) => {
        const author = userLabel(post.user_id);
        const reactions = post.community_post_reactions || [];
        const comments = post.community_post_comments || [];
        const likeCount = reactions.filter((item) => item.reaction === "like").length;
        const dislikeCount = reactions.filter((item) => item.reaction === "dislike").length;
        const ownReaction = currentUser
          ? reactions.find((item) => item.user_id === currentUser.id)?.reaction || null
          : null;
        const canEditPost = canModerate(post.user_id);
        const commentsHtml = comments
          .map((comment) => {
            const canManageComment = canModerate(comment.user_id);
            return `<article class="community-comment">
              <p><strong>${escapeHtml(userLabel(comment.user_id))}:</strong> ${escapeHtml(comment.content)}</p>
              <p class="muted-text">${escapeHtml(formatDate(comment.created_at))}</p>
              ${
                canManageComment
                  ? `<button type="button" class="btn-secondary community-comment-delete-btn" data-id="${comment.id}" data-post-id="${post.id}">Delete</button>`
                  : ""
              }
            </article>`;
          })
          .join("");

        return `<article class="community-post" data-post-id="${post.id}">
          <div class="community-post-head">
            <h3>${escapeHtml(author)}</h3>
            <p class="muted-text">Updated ${escapeHtml(formatDate(post.updated_at || post.created_at))}</p>
          </div>
          <p>${escapeHtml(post.content)}</p>
          <div class="community-post-actions">
            <button type="button" class="btn-secondary reaction-btn ${ownReaction === "like" ? "is-active" : ""}" data-post-id="${post.id}" data-reaction="like">Like (${likeCount})</button>
            <button type="button" class="btn-secondary reaction-btn ${ownReaction === "dislike" ? "is-active" : ""}" data-post-id="${post.id}" data-reaction="dislike">Dislike (${dislikeCount})</button>
            ${
              canEditPost
                ? `<button type="button" class="btn-secondary community-post-edit-btn" data-post-id="${post.id}">Edit</button>
                   <button type="button" class="btn-secondary community-post-delete-btn-inline" data-post-id="${post.id}">Delete</button>`
                : ""
            }
          </div>
          <div class="community-comments">
            <h4>Comments</h4>
            <div class="community-comment-list">${commentsHtml || `<p class="muted-text">No comments yet.</p>`}</div>
            <form class="community-comment-form" data-post-id="${post.id}">
              <label for="community-comment-input-${post.id}">Add comment</label>
              <textarea id="community-comment-input-${post.id}" rows="3" maxlength="1000" required></textarea>
              <button type="submit" class="btn-primary">Comment</button>
            </form>
          </div>
        </article>`;
      })
      .join("");

    Array.from(list.querySelectorAll(".reaction-btn")).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const postId = Number(btn.dataset.postId || "0");
        const reaction = btn.dataset.reaction || "";
        if (!postId || !reaction) return;
        await setReaction(postId, reaction);
        await loadCommunity(reviewSlug);
      });
    });

    Array.from(list.querySelectorAll(".community-post-edit-btn")).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const postId = Number(btn.dataset.postId || "0");
        const existing = posts.find((item) => item.id === postId);
        if (!existing) return;
        const updated = window.prompt("Edit community post", existing.content);
        if (!updated || !updated.trim()) return;
        const { error: updateError } = await client
          .from("community_posts")
          .update({ content: updated.trim(), updated_at: new Date().toISOString() })
          .eq("id", postId);
        if (updateError) {
          setStatus("community-post-status", updateError.message, "error");
          return;
        }
        await loadCommunity(reviewSlug);
      });
    });

    Array.from(list.querySelectorAll(".community-post-delete-btn-inline")).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const postId = Number(btn.dataset.postId || "0");
        if (!postId) return;
        const { error: deleteError } = await client.from("community_posts").delete().eq("id", postId);
        if (deleteError) {
          setStatus("community-post-status", deleteError.message, "error");
          return;
        }
        await loadCommunity(reviewSlug);
      });
    });

    Array.from(list.querySelectorAll(".community-comment-form")).forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!currentUser) {
          setStatus("community-post-status", "Sign in to comment.", "info");
          return;
        }
        const postId = Number(form.dataset.postId || "0");
        const textarea = form.querySelector("textarea");
        const content = (textarea?.value || "").trim();
        if (!postId || !content) return;
        const { error: commentError } = await client.from("community_post_comments").insert({
          post_id: postId,
          user_id: currentUser.id,
          content,
        });
        if (commentError) {
          setStatus("community-post-status", commentError.message, "error");
          return;
        }
        if (textarea) textarea.value = "";
        await loadCommunity(reviewSlug);
      });
    });

    Array.from(list.querySelectorAll(".community-comment-delete-btn")).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id || "0");
        if (!id) return;
        const { error: deleteError } = await client.from("community_post_comments").delete().eq("id", id);
        if (deleteError) {
          setStatus("community-post-status", deleteError.message, "error");
          return;
        }
        await loadCommunity(reviewSlug);
      });
    });
  }

  async function init() {
    await hydrateSession();
    await upsertProfileIfNeeded();
    client.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;
      setNav(currentUser);
      await hydrateSession();
      if (favoritesRoot) await initFavoritesPage();
      if (reviewRoot) await initReviewFeatures();
    });

    if (favoritesRoot) await initFavoritesPage();
    if (reviewRoot) await initReviewFeatures();
  }

  init();
})();
