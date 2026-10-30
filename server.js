const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'registrations.json');

// Helper: Escape HTML to prevent XSS attacks in Admin panel
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const loadData = () => {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    return [];
  }
};

const saveData = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// 🔐 Secure Admin Authentication via Environment Variables
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Access Required"');
    return res.status(401).send('Authentication required.');
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS = process.env.ADMIN_PASS;

  if (!ADMIN_USER || !ADMIN_PASS) {
    return res.status(500).send('Server configuration error: Admin credentials are not set in environment variables.');
  }

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Access Required"');
    return res.status(401).send('Invalid username or password.');
  }
};

// API Route: Handle Registration with basic input validation
app.post('/api/register', (req, res) => {
  const { name, email, phone, query, location, manualAddress } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ success: false, message: 'Name, email, and phone are required!' });
  }

  const registrations = loadData();

  const hasLocation = location && location.latitude && location.longitude;
  const mapsUrl = hasLocation 
    ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}` 
    : null;

  const newEntry = {
    id: Date.now(),
    name: escapeHtml(name),
    email: escapeHtml(email),
    phone: escapeHtml(phone),
    query: escapeHtml(query || 'N/A'),
    locationType: hasLocation ? 'GPS Coordinates' : 'Manual Address',
    locationDetails: {
      latitude: hasLocation ? location.latitude : 'N/A',
      longitude: hasLocation ? location.longitude : 'N/A',
      accuracyMeters: hasLocation ? location.accuracy : 'N/A',
      manualAddress: escapeHtml(manualAddress || 'N/A')
    },
    googleMapsLink: mapsUrl || (manualAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(manualAddress)}` : 'Location Not Provided'),
    registeredAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  };

  registrations.push(newEntry);
  saveData(registrations);

  res.status(200).json({ success: true, message: 'Registration successful!', data: newEntry });
});

// Protected Admin Submissions JSON API
app.get('/api/admin/submissions', adminAuth, (req, res) => {
  const registrations = loadData();
  res.json({ totalEntries: registrations.length, data: registrations });
});

// Protected Admin Dashboard View with XSS Escaping
app.get('/admin', adminAuth, (req, res) => {
  const registrations = loadData();
  
  let rows = registrations.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${item.name}</strong></td>
      <td>${item.email}<br><small>${item.phone}</small></td>
      <td>${item.query}</td>
      <td>
        <span style="font-size: 0.8rem; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${item.locationType}</span><br>
        ${item.locationType === 'GPS Coordinates' 
          ? `<a href="${item.googleMapsLink}" target="_blank" style="color: #1a73e8; font-weight: bold;">📍 Open GPS Map</a>` 
          : `🏠 ${item.locationDetails.manualAddress}`}
      </td>
      <td><small>${item.registeredAt}</small></td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Event Registrations Dashboard</title>
      <style>
        body { font-family: sans-serif; padding: 20px; background: #f4f6f8; }
        h1 { color: #333; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #1a73e8; color: white; }
        tr:hover { background: #f1f1f1; }
      </style>
    </head>
    <body>
      <h1>Event Registrations (${registrations.length})</h1>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Contact</th>
            <th>Query</th>
            <th>Location / Address</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length > 0 ? rows : '<tr><td colspan="6" style="text-align:center;">No registrations yet.</td></tr>'}
        </tbody>
      </table>
    </body>
    </html>
  `;
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
