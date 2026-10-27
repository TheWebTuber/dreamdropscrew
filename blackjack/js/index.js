const rollBtn = document.getElementById('rollBtn'); const story = document.getElementById('story');

const storyEvents = [ 'Blackjack wins his first enchanted deck.', 'A rival casino lord challenges fate.', 'A cursed coin reveals an ancient Fire Emblem.', 'The fox risks everything for his kingdom.' ];

rollBtn.addEventListener('click', () => { const event = storyEvents[Math.floor(Math.random() * storyEvents.length)]; story.innerHTML = `<h2>Your Fate Is Cast</h2><p>${event}</p>`; });