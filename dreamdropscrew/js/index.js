const slides = [
  {
    title: "Welcome!",
    text: "Welcome to the Dream Drops Crew Website",
  },
  {
    title: "About Us",
    text: "We are just random group of people doing content for fun!",
  },
  {
    title: "Follow us, share and enjoy!",
    text: "Be sure to stay tuned for the newest streams or content, either on Youtube or on Twitch! Did you know our patreon is free too?",
  },
];

let currentSlide = 0;

function updateSlide() {
  document.querySelector("#info-slide h2").textContent =
    slides[currentSlide].title;
  document.querySelector("#info-slide p").textContent =
    slides[currentSlide].text;
}

function prevSlide() {
  currentSlide = (currentSlide - 1 + slides.length) % slides.length;
  updateSlide();
}

function nextSlide() {
  currentSlide = (currentSlide + 1) % slides.length;
  updateSlide();
}

// Example YouTube video lists by category
const videoData = {
  games: [
    "https://www.youtube.com/watch?v=ji3jc4sy95I",
    "https://www.youtube.com/watch?v=Z-G1UT4Ox7Q&t=3285s",
    "https://www.youtube.com/watch?v=Q6ffYTqgL4M",
    "https://www.youtube.com/watch?v=UNvncMARtLw",
    "https://www.youtube.com/watch?v=mnq_27QnHDY",
  ],
  drawing: [
    "https://www.youtube.com/watch?v=xnnwAmRQ29I",
    "https://www.youtube.com/watch?v=tUIhmFW0KG4",
    "https://www.youtube.com/watch?v=0lYLo62iYgU",
    "https://www.youtube.com/watch?v=5mv4yQzRK6k&list=PL5420N1feOV9uhe8xovHkcroYKImu8QYl",
    "https://www.youtube.com/watch?v=EFwmdKxvZ40&list=PL5420N1feOV_MbUU5HKIJjPbLPQHqYuA-&index=5",
  ],
  fun: [
    "https://www.youtube.com/shorts/TqwJUXcLGA4",
    "https://www.youtube.com/shorts/UZE5lIfuE8g",
    "https://www.youtube.com/shorts/1IeiNJXit-g",
    "https://www.youtube.com/shorts/NJWUsHxeYEg",
    "https://www.youtube.com/shorts/sEytw-6MwNs",
  ],
};

// Helper to get YouTube thumbnail from URL
function getYouTubeThumbnail(url) {
  // Try to match regular video
  let match = url.match(/v=([^&]+)/);
  if (match) {
    return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  // Try to match Shorts
  match = url.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return "";
}

// Render video thumbnails for a category
function renderSlider(category, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  videoData[category].forEach((url) => {
    const thumb = getYouTubeThumbnail(url);
    const videoEl = document.createElement("a");
    videoEl.href = url;
    videoEl.target = "_blank";
    videoEl.className = "video-thumb";
    videoEl.innerHTML = `<img src="${thumb}" alt="Video thumbnail"><span>Watch</span>`;
    container.appendChild(videoEl);
  });
}

function makeSliderInfinite(sliderId) {
  const slider = document.getElementById(sliderId);
  if (!slider) return;

  // Only clone once
  if (!slider.dataset.infinite) {
    const items = Array.from(slider.children);
    // Clone just enough items to fill one row (5 for desktop, 2 for mobile)
    const clonesNeeded = window.innerWidth <= 600 ? 2 : 5;
    for (let i = 0; i < clonesNeeded; i++) {
      const clone = items[i].cloneNode(true);
      clone.classList.add("slider-clone");
      slider.appendChild(clone);
    }
    slider.dataset.infinite = "true";
  }
}

function autoScrollSlider(sliderId, speed = 0.5) {
  const slider = document.getElementById(sliderId);
  if (!slider) return;

  makeSliderInfinite(sliderId);

  setInterval(() => {
    if (slider.scrollWidth - slider.clientWidth > 0) {
      slider.scrollLeft += speed;
      // When reaching the end of original items, reset to start
      const clones = slider.querySelectorAll(".slider-clone").length;
      const itemWidth =
        slider.firstElementChild.offsetWidth +
        parseInt(getComputedStyle(slider).gap || 0);
      const resetPoint = itemWidth * (slider.children.length - clones);
      if (slider.scrollLeft >= resetPoint) {
        slider.scrollLeft = 0;
      }
    }
  }, 30);
}

window.onload = function () {
  updateSlide();
  renderSlider("games", "games-slider");
  renderSlider("drawing", "drawing-slider");
  renderSlider("fun", "fun-slider");
  // No autoScrollSlider calls!
};
