# 🎵 iBand Backend

[![Backend Health](https://img.shields.io/badge/Backend%20Health-UP-34c759?style=for-the-badge)](https://iband-backend-first-2.onrender.com/health)
[![Live API](https://img.shields.io/badge/Live%20API-BROWSE-0a84ff?style=for-the-badge)](https://iband-backend-first-2.onrender.com/artists)

This is the **backend for the iBand Platform**, powering unsigned music artists to showcase their music, connect with fans, and get discovered by labels.  
Built with **Node.js**, **Express**, and **MongoDB**; deployed on **Render**.

---

## 🚀 Features
- RESTful API with **Express**
- **MongoDB** via **Mongoose**
- Artist profiles (name, genre, bio, image, votes, comments)
- Voting + comments endpoints
- **Health** endpoint for monitoring
- Environment variables with **dotenv**
- **CORS** enabled for the frontend

---

## 🔗 Live Endpoints
- **Health** → https://iband-backend-first-2.onrender.com/health  
- **Artists** → https://iband-backend-first-2.onrender.com/artists  
- **Vote (replace `:id`)** → https://iband-backend-first-2.onrender.com/artists/:id/vote  
- **Comments (replace `:id`)** → https://iband-backend-first-2.onrender.com/artists/:id/comments  

---

## 🎤 API Reference

### Artists
- `GET /artists` — Get all artists  
- `GET /artists/:id` — Get a single artist  
- `POST /artists` — Create artist  
- `PUT /artists/:id` — Update artist  
- `DELETE /artists/:id` — Delete artist  

### Votes
- `POST /artists/:id/vote` — Add a vote  

### Comments
- `GET /artists/:id/comments` — List comments  
- `POST /artists/:id/comments` — Add comment  

---

## 🛠️ Local Development

### 1) Install
```bash
npm install