const gallery = document.getElementById("gallery");

// Folder path for preview
const previewFolder = "jdemotes/"; // <— actual folder where GIFs live on your server
// Folder path for shareable URL
const urlFolder = "dreamdropscrew/jdemotes/"; // <— what you want in the link

fetch("jdgifs.json")
  .then(res => res.json())
  .then(gifs => {

    gifs.forEach(file => {

        const card = document.createElement("div");
        card.className = "card";

        const img = document.createElement("img");
        img.src = previewFolder + file; // use raw filename for preview

        const info = document.createElement("div");
        info.className = "info";

        const name = file.replace(/\.[^/.]+$/, "");

        const title = document.createElement("div");
        title.className = "filename";
        title.textContent = name;

        const button = document.createElement("button");
        button.className = "share-btn";
        button.textContent = "Copy Link";

        button.onclick = () => {
            // Encode filename for shareable URL
            const url = window.location.origin + "/" + urlFolder + encodeURIComponent(file);
            navigator.clipboard.writeText(url).then(() => {
                button.textContent = "Copied!";
                setTimeout(() => {
                    button.textContent = "Copy Link";
                }, 1500);
            });
        };

        info.appendChild(title);
        info.appendChild(button);

        card.appendChild(img);
        card.appendChild(info);

        gallery.appendChild(card);
    });

  })
  .catch(err => {
    console.error("Failed to load gifs.json:", err);
  });