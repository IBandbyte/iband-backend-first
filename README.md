# 🎵 iBand Backend

[![Backend Health](https://img.shields.io/badge/Backend%20Health-UP-brightgreen?style=for-the-badge)](https://iband-backend-first-2.onrender.com/health)

This is the **backend for the iBand Platform**, powering unsigned music artists to showcase their music, connect with fans, and get discovered by labels.  
It is built with **Node.js**, **Express**, and **MongoDB**, and deployed on **Render**.

---

## ⚡ Features

- RESTful API built with **Express**
- **MongoDB** database via Mongoose
- Artist profiles (name, genre, bio, image, votes, comments)
- Voting + comments system
- Health check endpoint for monitoring
- Secure environment variables with **dotenv**
- CORS enabled for frontend connections

---

## 🔗 API Endpoints

Base URL:  
`https://iband-backend-first-2.onrender.com`

### 🎤 Artists
- `GET /artists` — Get all artists  
- `GET /artists/:id` — Get a single artist by ID  
- `POST /artists` — Add a new artist  
- `PUT /artists/:id` — Update artist details  
- `DELETE /artists/:id` — Remove an artist  

### 🗳 Votes
- `POST /artists/:id/vote` — Add a vote for an artist  

### 💬 Comments
- `GET /artists/:id/comments` — Get all comments for an artist  
- `POST /artists/:id/comments` — Add a new comment  

### ❤️ Health
- `GET /health` — Check backend health  

---

## 🛠 Local Development

### 1. Clone the repo
```bash
git clone https://github.com/IBandbyte/iband-backend-first.git
cd iband-backend-first