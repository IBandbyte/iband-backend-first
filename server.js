const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const artistsRoutes = require('./artists');
const commentsRoutes = require('./comments');
const votesRoutes = require('./votes');
const adminRoutes = require('./admin');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/artists', artistsRoutes);
app.use('/comments', commentsRoutes);
app.use('/votes', votesRoutes);
app.use('/admin', adminRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((error) => {
    console.error('MongoDB connection error:', error);
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});