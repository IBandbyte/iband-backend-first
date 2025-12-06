import fs from "fs";
import path from "path";

const FILE_PATH = path.join(process.cwd(), "artists.json");

class ArtistsStore {
  constructor() {
    this.ensureFile();
  }

  ensureFile() {
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify([]));
    }
  }

  read() {
    const raw = fs.readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(raw || "[]");
  }

  write(data) {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
  }

  all() {
    return this.read();
  }

  seed(artist) {
    const artists = this.read();

    const newArtist = {
      id: String(Date.now()),
      name: artist.name,
      genre: artist.genre,
      bio: artist.bio,
      imageUrl: artist.imageUrl,
      createdAt: new Date().toISOString(),
    };

    artists.push(newArtist);
    this.write(artists);

    return newArtist;
  }
}

export default new ArtistsStore();