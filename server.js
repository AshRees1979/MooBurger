require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mooburger2026';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

const REVIEW_SECTIONS = [
  { key: 'locationVibe',    emoji: '🏠', title: 'Location Vibe',       hint: 'What\'s the atmosphere like? Cosy? Loud? Trendy?' },
  { key: 'pattyTaste',      emoji: '🥩', title: 'Plain Patty Taste',   hint: 'How does the meat taste on its own?' },
  { key: 'fattyness',       emoji: '🔥', title: 'Fattyness',           hint: 'Grease level? Juicy or dry?' },
  { key: 'theBun',          emoji: '🍞', title: 'The Bun',             hint: 'Soft? Toasted? Brioche? Falling apart?' },
  { key: 'theSauce',        emoji: '🥫', title: 'The Sauce',           hint: 'What sauces? Any signature ones?' },
  { key: 'theCheese',       emoji: '🧀', title: 'The Cheese',          hint: 'Melted perfection or an afterthought?' },
  { key: 'theFries',        emoji: '🍟', title: 'The Fries',           hint: 'Skinny? Chunky? Seasoned? Crispy enough?' },
  { key: 'theExtras',       emoji: '🥓', title: 'The Extras',          hint: 'Toppings, sides, onion rings, slaw...' },
  { key: 'theDrinks',       emoji: '🍺', title: 'The Drinks',          hint: 'Shakes? Craft beer? Decent Coke?' },
  { key: 'serviceSpeed',    emoji: '⏱️', title: 'Service & Wait',      hint: 'How long? Friendly staff?' },
  { key: 'instagramWorthy', emoji: '📸', title: 'Instagram Worthy?',   hint: 'Is this burger photogenic?' },
  { key: 'wouldGoBack',     emoji: '🔄', title: 'Would You Go Back?',  hint: 'The ultimate question.' }
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    cb(null, extOk && mimeOk);
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'moo-burger-secret-change-in-production',
  resave: false,
  saveUninitialized: false
}));

app.use((req, res, next) => {
  res.locals.isAdmin = req.session.isAdmin || false;
  res.locals.googleMapsApiKey = GOOGLE_MAPS_API_KEY;
  res.locals.reviewSections = REVIEW_SECTIONS;
  next();
});

function extractSections(body) {
  const sections = {};
  REVIEW_SECTIONS.forEach(s => {
    if (body[`section_${s.key}`] && body[`section_${s.key}`].trim()) {
      sections[s.key] = body[`section_${s.key}`].trim();
    }
  });
  return sections;
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  next();
}

// ─── Logo Fetcher ────────────────────────────────────────────
async function fetchLogoFromWebsite(websiteUrl) {
  try {
    const resp = await fetch(websiteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MooBurger/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const baseUrl = new URL(websiteUrl).origin;

    const candidates = [];

    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch) candidates.push(ogMatch[1]);

    const twitterMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twitterMatch) candidates.push(twitterMatch[1]);

    const largeIconMatches = [...html.matchAll(/<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/gi)];
    largeIconMatches.forEach(m => candidates.push(m[1]));

    for (const raw of candidates) {
      try {
        const imgUrl = raw.startsWith('http') ? raw : new URL(raw, baseUrl).href;
        if (/\.ico$/i.test(imgUrl)) continue;

        const imgResp = await fetch(imgUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MooBurger/1.0)' },
          redirect: 'follow',
          signal: AbortSignal.timeout(8000)
        });
        if (!imgResp.ok) continue;

        const contentType = imgResp.headers.get('content-type') || '';
        if (contentType.includes('x-icon') || contentType.includes('vnd.microsoft.icon')) continue;

        const extMap = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' };
        let ext = Object.entries(extMap).find(([mime]) => contentType.includes(mime))?.[1];
        if (!ext) {
          const urlPath = new URL(imgUrl).pathname;
          ext = path.extname(urlPath) || '.png';
        }

        const buffer = Buffer.from(await imgResp.arrayBuffer());
        if (buffer.length < 5000 && !contentType.includes('svg')) continue;

        const filename = `logo-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
        const dest = path.join(__dirname, 'public', 'uploads', filename);
        fs.writeFileSync(dest, buffer);
        return filename;
      } catch { continue; }
    }
  } catch { /* website unreachable */ }
  return null;
}

// ─── Google Places API Proxy ─────────────────────────────────
app.get('/api/place-details', async (req, res) => {
  const { placeId } = req.query;
  if (!placeId || !GOOGLE_MAPS_API_KEY) {
    return res.json({ error: 'Missing placeId or API key not configured' });
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,formatted_address,formatted_phone_number,website,geometry,url&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === 'OK') {
      const p = data.result;
      let logoFilename = null;
      if (p.website) {
        logoFilename = await fetchLogoFromWebsite(p.website);
      }
      res.json({
        name: p.name,
        formattedAddress: p.formatted_address,
        phone: p.formatted_phone_number || null,
        website: p.website || null,
        mapsUrl: p.url || null,
        lat: p.geometry?.location?.lat || null,
        lng: p.geometry?.location?.lng || null,
        logo: logoFilename
      });
    } else {
      res.json({ error: data.status });
    }
  } catch (err) {
    res.json({ error: 'Failed to fetch place details' });
  }
});

// ─── Landing Page ────────────────────────────────────────────
app.get('/', (req, res) => {
  const restaurants = db.getAllRestaurants();
  res.render('index', { restaurants });
});

// ─── Tier List ──────────────────────────────────────────────
app.get('/tierlist', (req, res) => {
  const restaurants = db.getAllRestaurants();
  res.render('tierlist', { restaurants });
});

// ─── Restaurant Detail ──────────────────────────────────────
app.get('/restaurant/:id', (req, res) => {
  const restaurant = db.getRestaurant(req.params.id);
  if (!restaurant) return res.status(404).render('404');
  const reviews = db.getRestaurantReviews(req.params.id);
  const photos = db.getRestaurantPhotos(req.params.id);
  const adminReview = db.getAdminReview(req.params.id);

  const calcAvg = (list) => list.length > 0
    ? list.reduce((sum, rv) => sum + (rv.pattyPower + rv.juiceFactor + rv.bunGame + rv.bangForBuck + rv.mooVibes) / 5, 0) / list.length
    : 0;
  const adminReviews = reviews.filter(rv => rv.isAdmin);
  const userReviews = reviews.filter(rv => !rv.isAdmin);
  const scores = {
    admin: calcAvg(adminReviews),
    user: calcAvg(userReviews),
    adminCount: adminReviews.length,
    userCount: userReviews.length
  };

  res.render('restaurant', { restaurant, reviews, photos, adminReview, scores });
});

// ─── User Submission Page ───────────────────────────────────
app.get('/submit', (req, res) => {
  res.render('submit', { prefill: req.query.recommend || '' });
});

app.post('/submit', upload.array('photos', 10), (req, res) => {
  const { name, location, description, submittedBy, reviewText, pattyPower, juiceFactor, bunGame, bangForBuck, mooVibes, placeId, formattedAddress, phone, website, lat, lng, autoLogo } = req.body;

  const coverImage = (req.files && req.files[0]) ? req.files[0].filename : (autoLogo || null);

  const result = db.createRestaurant({
    name, location, description,
    coverImage,
    isAdmin: false,
    submittedBy: submittedBy || 'Anonymous',
    placeId, formattedAddress, phone, website, lat, lng
  });

  const restaurantId = result.lastInsertRowid;

  if (reviewText) {
    db.addReview({
      restaurantId,
      reviewerName: submittedBy || 'Anonymous',
      reviewText,
      pattyPower: parseInt(pattyPower) || 3,
      juiceFactor: parseInt(juiceFactor) || 3,
      bunGame: parseInt(bunGame) || 3,
      bangForBuck: parseInt(bangForBuck) || 3,
      mooVibes: parseInt(mooVibes) || 3,
      isAdmin: false,
      sections: extractSections(req.body)
    });
  }

  if (req.files) {
    req.files.forEach(file => {
      db.addPhoto({
        restaurantId,
        filename: file.filename,
        caption: '',
        uploadedBy: submittedBy || 'Anonymous',
        isAdmin: false
      });
    });
  }

  res.redirect('/?submitted=true');
});

// ─── User Review on Restaurant ──────────────────────────────
app.post('/restaurant/:id/review', (req, res) => {
  const { reviewerName, reviewText, pattyPower, juiceFactor, bunGame, bangForBuck, mooVibes } = req.body;
  db.addReview({
    restaurantId: req.params.id,
    reviewerName: reviewerName || 'Anonymous',
    reviewText,
    pattyPower: parseInt(pattyPower) || 3,
    juiceFactor: parseInt(juiceFactor) || 3,
    bunGame: parseInt(bunGame) || 3,
    bangForBuck: parseInt(bangForBuck) || 3,
    mooVibes: parseInt(mooVibes) || 3,
    isAdmin: req.session.isAdmin || false,
    sections: extractSections(req.body)
  });
  res.redirect(`/restaurant/${req.params.id}?reviewed=true`);
});

// ─── User Photo Upload ──────────────────────────────────────
app.post('/restaurant/:id/photo', upload.array('photos', 5), (req, res) => {
  if (req.files) {
    req.files.forEach(file => {
      db.addPhoto({
        restaurantId: req.params.id,
        filename: file.filename,
        caption: req.body.caption || '',
        uploadedBy: req.body.uploadedBy || 'Anonymous',
        isAdmin: req.session.isAdmin || false
      });
    });
  }
  res.redirect(`/restaurant/${req.params.id}`);
});

// ─── Admin Login ────────────────────────────────────────────
app.get('/admin/login', (req, res) => {
  res.render('admin-login', { error: null });
});

app.post('/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('admin-login', { error: 'Wrong password, try again!' });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// ─── Admin Dashboard ────────────────────────────────────────
app.get('/admin', requireAdmin, (req, res) => {
  const restaurants = db.getAllRestaurants();
  const pendingRestaurants = db.getPendingRestaurants();
  const pendingReviews = db.getPendingReviews();
  res.render('admin', { restaurants, pendingRestaurants, pendingReviews });
});

// ─── Admin: Create Restaurant ───────────────────────────────
app.post('/admin/restaurant', requireAdmin, upload.array('photos', 10), (req, res) => {
  const { name, location, description, reviewText, pattyPower, juiceFactor, bunGame, bangForBuck, mooVibes, placeId, formattedAddress, phone, website, lat, lng, autoLogo } = req.body;

  const coverImage = (req.files && req.files[0]) ? req.files[0].filename : (autoLogo || null);

  const result = db.createRestaurant({
    name, location, description,
    coverImage,
    isAdmin: true,
    submittedBy: 'MooBurger Team',
    placeId, formattedAddress, phone, website, lat, lng
  });

  const restaurantId = result.lastInsertRowid;

  if (reviewText) {
    db.addReview({
      restaurantId,
      reviewerName: 'MooBurger Team',
      reviewText,
      pattyPower: parseInt(pattyPower) || 3,
      juiceFactor: parseInt(juiceFactor) || 3,
      bunGame: parseInt(bunGame) || 3,
      bangForBuck: parseInt(bangForBuck) || 3,
      mooVibes: parseInt(mooVibes) || 3,
      isAdmin: true,
      sections: extractSections(req.body)
    });
  }

  if (req.files) {
    req.files.forEach(file => {
      db.addPhoto({
        restaurantId,
        filename: file.filename,
        caption: '',
        uploadedBy: 'MooBurger Team',
        isAdmin: true
      });
    });
  }

  res.redirect('/admin');
});

// ─── Admin: Review a Restaurant ─────────────────────────────
app.post('/admin/restaurant/:id/review', requireAdmin, upload.array('photos', 10), (req, res) => {
  const { reviewText, pattyPower, juiceFactor, bunGame, bangForBuck, mooVibes } = req.body;

  db.addReview({
    restaurantId: req.params.id,
    reviewerName: 'MooBurger Team',
    reviewText,
    pattyPower: parseInt(pattyPower) || 3,
    juiceFactor: parseInt(juiceFactor) || 3,
    bunGame: parseInt(bunGame) || 3,
    bangForBuck: parseInt(bangForBuck) || 3,
    mooVibes: parseInt(mooVibes) || 3,
    isAdmin: true,
    sections: extractSections(req.body)
  });

  if (!db.getRestaurant(req.params.id).isAdminCreated) {
    db.validateRestaurant(req.params.id);
  }

  if (req.files) {
    req.files.forEach(file => {
      db.addPhoto({
        restaurantId: req.params.id,
        filename: file.filename,
        caption: '',
        uploadedBy: 'MooBurger Team',
        isAdmin: true
      });
    });
  }

  res.redirect(`/restaurant/${req.params.id}`);
});

// ─── Admin: Edit a Review ───────────────────────────────────
app.post('/admin/review/:id/edit', requireAdmin, (req, res) => {
  const { reviewText, pattyPower, juiceFactor, bunGame, bangForBuck, mooVibes } = req.body;
  const review = db.getReview(req.params.id);
  if (!review) return res.redirect('/admin');

  db.updateReview(req.params.id, {
    reviewText,
    pattyPower: parseInt(pattyPower) || 3,
    juiceFactor: parseInt(juiceFactor) || 3,
    bunGame: parseInt(bunGame) || 3,
    bangForBuck: parseInt(bangForBuck) || 3,
    mooVibes: parseInt(mooVibes) || 3,
    sections: extractSections(req.body)
  });

  res.redirect(`/restaurant/${review.restaurantId}`);
});

// ─── Admin: Validate ────────────────────────────────────────
app.post('/admin/restaurant/:id/validate', requireAdmin, (req, res) => {
  db.validateRestaurant(req.params.id);
  res.redirect('/admin');
});

app.post('/admin/review/:id/validate', requireAdmin, (req, res) => {
  db.validateReview(req.params.id);
  const review = db.getReview(req.params.id);
  if (review) return res.redirect('/admin');
  res.redirect('/admin');
});

// ─── Admin: Delete ──────────────────────────────────────────
app.post('/admin/restaurant/:id/delete', requireAdmin, (req, res) => {
  db.deleteRestaurant(req.params.id);
  res.redirect('/admin');
});

app.post('/admin/review/:id/delete', requireAdmin, (req, res) => {
  db.deleteReview(req.params.id);
  res.redirect('/admin');
});

app.post('/admin/photo/:id/delete', requireAdmin, (req, res) => {
  const photo = db.getPhoto(req.params.id);
  if (photo) {
    const filePath = path.join(__dirname, 'public', 'uploads', photo.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.removePhoto(req.params.id);
  res.redirect('back');
});

// ─── 404 ────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`\n  🍔 MooBurger is sizzling on http://localhost:${PORT}\n`);
});
