const cards = document.querySelectorAll('#character-section .glass-card');

// Create navigation buttons
const btnContainer = document.createElement('div');
btnContainer.classList.add('slider-buttons');
btnContainer.innerHTML = `
  <button id="prevBtn">&#10094;</button>
  <button id="nextBtn">&#10095;</button>
`;
document.querySelector('#character-section').after(btnContainer);

let currentIndex = 0;

function showCard(index) {
  cards.forEach((card, i) => {
    card.classList.toggle('active', i === index);
  });
}

// Button listeners
document.getElementById('nextBtn').addEventListener('click', () => {
  currentIndex = (currentIndex + 1) % cards.length;
  showCard(currentIndex);
});

document.getElementById('prevBtn').addEventListener('click', () => {
  currentIndex = (currentIndex - 1 + cards.length) % cards.length;
  showCard(currentIndex);
});

// Initialize first card
showCard(currentIndex);
