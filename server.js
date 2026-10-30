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

// API Route: Handle Registration
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
    name,
    email,
    phone,
    query: query || 'N/A',
    locationType: hasLocation ? 'GPS Coordinates' : 'Manual Address',
    locationDetails: {
      latitude: hasLocation ? location.latitude : 'N/A',
      longitude: hasLocation ? location.longitude : 'N/A',
      accuracyMeters: hasLocation ? location.accuracy : 'N/A',
      manualAddress: manualAddress || 'N/A'
    },
    googleMapsLink: mapsUrl || (manualAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(manualAddress)}` : 'Location Not Provided'),
    registeredAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  };

  registrations.push(newEntry);
  saveData(registrations);

  res.status(200).json({ success: true, message: 'Registration successful!', data: newEntry });
});

// Admin Submissions JSON API
app.get('/api/admin/submissions', (req, res) => {
  const registrations = loadData();
  res.json({ totalEntries: registrations.length, data: registrations });
});

// Admin Dashboard View
app.get('/admin', (req, res) => {
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
