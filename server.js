const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// تخزين المفاتيح في الذاكرة (يفضل ربطها بـ Database لاحقاً)
let keysDatabase = {};

// 1. صفحة الموقع الرئيسية (لوحة التحكم UI)
app.get('/', (req, res) => {
    let rows = '';
    for (let key in keysDatabase) {
        let item = keysDatabase[key];
        rows += `
            <tr>
                <td><b>${key}</b></td>
                <td>${item.devices.length} / ${item.max_devices}</td>
                <td>${item.expires_at}</td>
                <td>
                    <form action="/admin/reset" method="POST" style="display:inline;">
                        <input type="hidden" name="key" value="${key}">
                        <button type="submit" class="btn-reset">Reset Devices</button>
                    </form>
                    <form action="/admin/delete" method="POST" style="display:inline;">
                        <input type="hidden" name="key" value="${key}">
                        <button type="submit" class="btn-delete">Delete</button>
                    </form>
                </td>
            </tr>
        `;
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="ar">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Key Manager Admin</title>
            <style>
                body { background-color: #0B0E14; color: #fff; font-family: sans-serif; padding: 20px; }
                .card { background: #131822; padding: 20px; border-radius: 12px; border: 1px solid #222938; max-width: 600px; margin: auto; }
                h2 { color: #C084FC; text-align: center; }
                input, button { width: 100%; padding: 10px; margin: 8px 0; border-radius: 8px; border: 1px solid #334155; box-sizing: border-box; }
                input { background: #1B2230; color: #fff; }
                button { background: #C084FC; color: #fff; font-weight: bold; cursor: pointer; border: none; }
                table { width: 100%; margin-top: 20px; border-collapse: collapse; }
                th, td { padding: 10px; text-align: left; border-bottom: 1px solid #222938; }
                .btn-reset { background: #334155; width: auto; padding: 5px 10px; font-size: 12px; }
                .btn-delete { background: #EF4444; width: auto; padding: 5px 10px; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>⚡ Key Manager Panel</h2>
                <form action="/admin/add" method="POST">
                    <input type="text" name="key" placeholder="Key Name (e.g. USER123)" required>
                    <input type="number" name="max_devices" placeholder="Max Devices (e.g. 1)" required>
                    <input type="number" name="days" placeholder="Duration in Days (e.g. 30)" required>
                    <button type="submit">Save / Create Key</button>
                </form>

                <table>
                    <thead>
                        <tr>
                            <th>Key</th>
                            <th>Devices</th>
                            <th>Expires</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </body>
        </html>
    `);
});

// 2. عمليات الموقع (إضافة - مسح أجهزة - حذف)
app.post('/admin/add', (req, res) => {
    const { key, max_devices, days } = req.body;
    let expDate = new Date();
    expDate.setDate(expDate.getDate() + parseInt(days));

    keysDatabase[key] = {
        max_devices: parseInt(max_devices),
        expires_at: expDate.toISOString().replace('T', ' ').substring(0, 19),
        devices: []
    };
    res.redirect('/');
});

app.post('/admin/reset', (req, res) => {
    const { key } = req.body;
    if (keysDatabase[key]) keysDatabase[key].devices = [];
    res.redirect('/');
});

app.post('/admin/delete', (req, res) => {
    const { key } = req.body;
    delete keysDatabase[key];
    res.redirect('/');
});

// 3. رابط فحص المفتاح الخاص بـ Sketchware (API)
app.post('/api/verify', (req, res) => {
    const { key, device_id } = req.body;
    const keyData = keysDatabase[key];

    if (!keyData) return res.json({ status: "error", message: "المفتاح غير موجود!" });

    // فحص انتهاء التاريخ
    if (new Date() > new Date(keyData.expires_at)) {
        return res.json({ status: "error", message: "اشتراك المفتاح انتهى!" });
    }

    // فحص الأجهزة
    if (!keyData.devices.includes(device_id)) {
        if (keyData.devices.length >= keyData.max_devices) {
            return res.json({ status: "error", message: "وصلت للحد الأقصى للأجهزة!" });
        }
        keyData.devices.push(device_id);
    }

    res.json({ status: "success", message: "تم تسجيل الدخول بنجاح!" });
});

app.listen(3000, () => console.log('Server running on port 3000'));
