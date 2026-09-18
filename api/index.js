const express = require('express');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const FIREBASE_URL = process.env.FIREBASE_URL || "https://key-system-10ff6-default-rtdb.firebaseio.com/";

if (!admin.apps.length) {
  admin.initializeApp({
    databaseURL: FIREBASE_URL
  });
}

const db = admin.database();
const keysRef = db.ref('keys');

// عرض اللوحة
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// جلب المفاتيح
app.get('/api/keys', async (req, res) => {
  try {
    const snapshot = await keysRef.once('value');
    const data = snapshot.val() || {};
    const keysList = Object.keys(data).map(k => ({
      key: k,
      ...data[k]
    }));
    res.json(keysList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إنشاء مفتاح جديد
app.post('/api/keys', async (req, res) => {
  const { name, maxDevices, durationDays } = req.body;
  if (!name) return res.status(400).json({ error: 'Key name required' });

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays || 30));

    await keysRef.child(name).set({
      maxDevices: parseInt(maxDevices || 1),
      durationDays: parseInt(durationDays || 30),
      devices: [],
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    });

    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إعادة ضبط الأجهزة
app.post('/api/keys/reset', async (req, res) => {
  const { key } = req.body;
  try {
    await keysRef.child(key).child('devices').set([]);
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// حذف مفتاح
app.post('/api/keys/delete', async (req, res) => {
  const { key } = req.body;
  try {
    await keysRef.child(key).remove();
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// فحص المفتاح من تطبيق Sketchware
app.post('/api/verify', async (req, res) => {
  const { key, device_id } = req.body;

  if (!key) return res.json({ status: 'error', message: 'invalid' });

  try {
    const snapshot = await keysRef.child(key).once('value');
    if (!snapshot.exists()) {
      return res.json({ status: 'error', message: 'invalid' });
    }

    const keyData = snapshot.val();

    if (new Date() > new Date(keyData.expiresAt)) {
      return res.json({ status: 'error', message: 'expired' });
    }

    let devices = keyData.devices || [];
    if (!Array.isArray(devices)) {
      devices = Object.values(devices);
    }

    if (device_id) {
      if (devices.includes(device_id)) {
        return res.json({ status: 'success', message: 'valid' });
      }

      if (devices.length >= keyData.maxDevices) {
        return res.json({ status: 'error', message: 'limit' });
      }

      devices.push(device_id);
      await keysRef.child(key).child('devices').set(devices);
    }

    return res.json({ status: 'success', message: 'valid' });

  } catch (err) {
    return res.json({ status: 'error', message: 'server error' });
  }
});

module.exports = app;
