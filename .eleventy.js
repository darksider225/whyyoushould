module.exports = function(eleventyConfig) {
  // Passthrough copies
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("images");
  
  // Collections
  eleventyConfig.addCollection("reviews", function(collectionApi) {
    return collectionApi
      .getFilteredByGlob("reviews/**/*.md")
      .sort((a, b) => new Date(b.data.reviewDate) - new Date(a.data.reviewDate));
  });
  
  eleventyConfig.addCollection("movies", function(collectionApi) {
    return collectionApi
      .getFilteredByGlob("reviews/**/*.md")
      .filter(item => item.data.type === "movie")
      .sort((a, b) => new Date(b.data.reviewDate) - new Date(a.data.reviewDate));
  });
  
  eleventyConfig.addCollection("games", function(collectionApi) {
    return collectionApi
      .getFilteredByGlob("reviews/**/*.md")
      .filter(item => item.data.type === "game")
      .sort((a, b) => new Date(b.data.reviewDate) - new Date(a.data.reviewDate));
  });
  
  // Filters
  eleventyConfig.addFilter("readableDate", dateObj => {
    return new Date(dateObj).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  });
  
  eleventyConfig.addFilter("verdictClass", verdict => {
    if (verdict === "Must Play" || verdict === "Must Watch") return "must";
    if (verdict === "Worth Your Time") return "worth";
    if (verdict === "Skip It") return "skip";
    return "";
  });
  
  return {
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site"
    },
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};
