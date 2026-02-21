const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    return { restaurants: [], reviews: [], photos: [], nextId: { restaurant: 1, review: 1, photo: 1 } };
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = {
  getAllRestaurants() {
    const data = loadDb();
    return data.restaurants.map(r => {
      const reviews = data.reviews.filter(rv => rv.restaurantId === r.id);

      const calcAvg = (list) => list.length > 0
        ? list.reduce((sum, rv) => sum + (rv.pattyPower + rv.juiceFactor + rv.bunGame + rv.bangForBuck + rv.mooVibes) / 5, 0) / list.length
        : 0;

      const adminReviews = reviews.filter(rv => rv.isAdmin);
      const userReviews = reviews.filter(rv => !rv.isAdmin);

      const admin_score = calcAvg(adminReviews);
      const user_score = calcAvg(userReviews);

      const scored = reviews.filter(rv => rv.isAdmin || rv.isValidated);
      const avg_score = calcAvg(scored);

      const photos = data.photos.filter(p => p.restaurantId === r.id);
      const firstPhoto = photos.sort((a, b) => (b.isAdmin ? 1 : 0) - (a.isAdmin ? 1 : 0))[0];
      return {
        ...r,
        avg_score,
        admin_score,
        user_score,
        admin_review_count: adminReviews.length,
        user_review_count: userReviews.length,
        review_count: reviews.length,
        first_photo: firstPhoto ? firstPhoto.filename : null
      };
    }).sort((a, b) => {
      if (b.avg_score !== a.avg_score) return b.avg_score - a.avg_score;
      if (b.review_count !== a.review_count) return b.review_count - a.review_count;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  },

  getRestaurant(id) {
    const data = loadDb();
    return data.restaurants.find(r => r.id === parseInt(id)) || null;
  },

  getRestaurantReviews(restaurantId) {
    const data = loadDb();
    return data.reviews
      .filter(rv => rv.restaurantId === parseInt(restaurantId))
      .sort((a, b) => {
        if (a.isAdmin !== b.isAdmin) return b.isAdmin ? 1 : -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  },

  getRestaurantPhotos(restaurantId) {
    const data = loadDb();
    return data.photos
      .filter(p => p.restaurantId === parseInt(restaurantId))
      .sort((a, b) => {
        if (a.isAdmin !== b.isAdmin) return b.isAdmin ? 1 : -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  },

  createRestaurant({ name, location, description, coverImage, isAdmin, submittedBy, placeId, formattedAddress, phone, website, lat, lng }) {
    const data = loadDb();
    const restaurant = {
      id: data.nextId.restaurant++,
      name,
      location: location || '',
      description: description || '',
      coverImage: coverImage || null,
      isAdminCreated: !!isAdmin,
      isValidated: !!isAdmin,
      submittedBy: submittedBy || 'Anonymous',
      placeId: placeId || null,
      formattedAddress: formattedAddress || null,
      phone: phone || null,
      website: website || null,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      createdAt: new Date().toISOString()
    };
    data.restaurants.push(restaurant);
    saveDb(data);
    return { lastInsertRowid: restaurant.id };
  },

  addReview({ restaurantId, reviewerName, reviewText, pattyPower, juiceFactor, bunGame, bangForBuck, mooVibes, isAdmin, sections }) {
    const data = loadDb();
    const review = {
      id: data.nextId.review++,
      restaurantId: parseInt(restaurantId),
      reviewerName: reviewerName || 'Anonymous',
      reviewText: reviewText || '',
      pattyPower: parseInt(pattyPower) || 3,
      juiceFactor: parseInt(juiceFactor) || 3,
      bunGame: parseInt(bunGame) || 3,
      bangForBuck: parseInt(bangForBuck) || 3,
      mooVibes: parseInt(mooVibes) || 3,
      sections: sections || {},
      isAdmin: !!isAdmin,
      isValidated: !!isAdmin,
      createdAt: new Date().toISOString()
    };
    data.reviews.push(review);
    saveDb(data);
    return review;
  },

  addPhoto({ restaurantId, filename, caption, uploadedBy, isAdmin }) {
    const data = loadDb();
    const photo = {
      id: data.nextId.photo++,
      restaurantId: parseInt(restaurantId),
      filename,
      caption: caption || '',
      uploadedBy: uploadedBy || 'Anonymous',
      isAdmin: !!isAdmin,
      createdAt: new Date().toISOString()
    };
    data.photos.push(photo);
    saveDb(data);
    return photo;
  },

  validateRestaurant(id) {
    const data = loadDb();
    const r = data.restaurants.find(r => r.id === parseInt(id));
    if (r) r.isValidated = true;
    saveDb(data);
  },

  validateReview(id) {
    const data = loadDb();
    const rv = data.reviews.find(rv => rv.id === parseInt(id));
    if (rv) rv.isValidated = true;
    saveDb(data);
  },

  deleteRestaurant(id) {
    const data = loadDb();
    const rid = parseInt(id);
    data.restaurants = data.restaurants.filter(r => r.id !== rid);
    data.reviews = data.reviews.filter(rv => rv.restaurantId !== rid);
    data.photos = data.photos.filter(p => p.restaurantId !== rid);
    saveDb(data);
  },

  deleteReview(id) {
    const data = loadDb();
    data.reviews = data.reviews.filter(rv => rv.id !== parseInt(id));
    saveDb(data);
  },

  getPhoto(id) {
    const data = loadDb();
    return data.photos.find(p => p.id === parseInt(id)) || null;
  },

  removePhoto(id) {
    const data = loadDb();
    data.photos = data.photos.filter(p => p.id !== parseInt(id));
    saveDb(data);
  },

  getAdminReview(restaurantId) {
    const data = loadDb();
    const adminReviews = data.reviews
      .filter(rv => rv.restaurantId === parseInt(restaurantId) && rv.isAdmin)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return adminReviews[0] || null;
  },

  getPendingRestaurants() {
    const data = loadDb();
    return data.restaurants
      .filter(r => !r.isAdminCreated && !r.isValidated)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getPendingReviews() {
    const data = loadDb();
    return data.reviews
      .filter(rv => !rv.isAdmin && !rv.isValidated)
      .map(rv => {
        const restaurant = data.restaurants.find(r => r.id === rv.restaurantId);
        return { ...rv, restaurant_name: restaurant ? restaurant.name : 'Unknown' };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getReview(id) {
    const data = loadDb();
    return data.reviews.find(rv => rv.id === parseInt(id)) || null;
  },

  updateReview(id, { reviewText, pattyPower, juiceFactor, bunGame, bangForBuck, mooVibes, sections }) {
    const data = loadDb();
    const rv = data.reviews.find(rv => rv.id === parseInt(id));
    if (!rv) return null;
    rv.reviewText = reviewText;
    rv.pattyPower = parseInt(pattyPower) || rv.pattyPower;
    rv.juiceFactor = parseInt(juiceFactor) || rv.juiceFactor;
    rv.bunGame = parseInt(bunGame) || rv.bunGame;
    rv.bangForBuck = parseInt(bangForBuck) || rv.bangForBuck;
    rv.mooVibes = parseInt(mooVibes) || rv.mooVibes;
    if (sections) rv.sections = sections;
    rv.updatedAt = new Date().toISOString();
    saveDb(data);
    return rv;
  }
};
