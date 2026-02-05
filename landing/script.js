/**
 * MACH Landing Page - Interactive Script
 * Handles smooth scrolling, analytics, and CTA tracking
 */

// Smooth scroll behavior for anchor links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    const href = this.getAttribute("href");
    if (href === "#") return;

    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
      // Track analytics event
      trackEvent("anchor_click", { anchor: href });
    }
  });
});

// Track CTA button clicks
document.querySelectorAll(".btn-primary, .btn-secondary").forEach((btn) => {
  btn.addEventListener("click", function () {
    const text = this.textContent.trim();
    const href = this.getAttribute("href");
    trackEvent("cta_click", { button_text: text, destination: href });
  });
});

// Track viewport visibility of sections
const observerOptions = {
  threshold: 0.3,
  rootMargin: "0px 0px -100px 0px",
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("in-view");
      trackEvent("section_view", { section: entry.target.id || entry.target.className });
    }
  });
}, observerOptions);

document
  .querySelectorAll(".features, .how-it-works, .pricing, .cta-final")
  .forEach((section) => {
    observer.observe(section);
  });

// Analytics function (ready for Plausible or similar)
function trackEvent(eventName, eventData) {
  // Plausible analytics integration (optional)
  if (window.plausible) {
    window.plausible(eventName, { props: eventData });
  }

  // Console logging for debugging
  console.log(`📊 Event: ${eventName}`, eventData);
}

// Page load tracking
document.addEventListener("DOMContentLoaded", () => {
  trackEvent("page_load", { referrer: document.referrer || "direct" });
});

// Track time on page (every 10 seconds)
let timeOnPage = 0;
setInterval(() => {
  timeOnPage += 10;
  if (timeOnPage % 30 === 0) {
    trackEvent("time_on_page", { seconds: timeOnPage });
  }
}, 10000);

// Scroll depth tracking
let maxScroll = 0;
window.addEventListener("scroll", () => {
  const scrollPercentage =
    (window.scrollY /
      (document.documentElement.scrollHeight - window.innerHeight)) *
    100;
  if (scrollPercentage > maxScroll) {
    maxScroll = scrollPercentage;
    if (maxScroll % 25 === 0) {
      trackEvent("scroll_depth", { percentage: Math.round(maxScroll) });
    }
  }
});

// Add subtle animations on scroll
const style = document.createElement("style");
style.textContent = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .in-view {
    animation: fadeInUp 0.6s ease-out forwards;
  }

  .feature-card {
    animation-delay: calc(var(--index, 0) * 0.1s);
  }
`;
document.head.appendChild(style);

// Add index to feature cards for staggered animation
document.querySelectorAll(".feature-card").forEach((card, index) => {
  card.style.setProperty("--index", index);
});
