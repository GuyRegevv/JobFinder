Perfect, let’s make a **step-by-step full guide** for turning your old laptop (Pop!\_OS = Ubuntu-based) into a mini server that runs your LinkedIn job crawler daily.
I’ll keep it practical but also explain *why* each step is done, and how to **undo** it later.

---

# 🖥️ 1. Keep the laptop always on

### 1.1 Stop sleep/suspend when the lid closes

On Linux, **systemd-logind** controls what happens when you close the lid.

1. Open the config:

   ```bash
   sudo nano /etc/systemd/logind.conf
   ```
2. Find the lines:

   ```
   #HandleLidSwitch=suspend
   #HandleLidSwitchDocked=suspend
   ```

   Change them to:

   ```
   HandleLidSwitch=ignore
   HandleLidSwitchDocked=ignore
   ```

   This tells Linux: “don’t suspend when lid closes (even if docked).”
3. Save (Ctrl+O, Enter) and exit (Ctrl+X).
4. Restart the service:

   ```bash
   sudo systemctl restart systemd-logind
   ```

✅ Now you can close the lid, and the laptop will **keep running**.
When you open the lid again, the screen will still turn back on as usual.

**Undo:**
Edit the file again and restore:

```
HandleLidSwitch=suspend
HandleLidSwitchDocked=suspend
```

then restart `systemd-logind`.

---

### 1.2 Prevent automatic sleep/suspend/hibernate

Pop!\_OS uses `systemd` targets. We’ll disable all auto-sleep modes:

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

* `mask` = makes the target impossible to trigger.
* This ensures nothing accidentally suspends the laptop.

**Undo:**

```bash
sudo systemctl unmask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

---

### 1.3 Power & screen settings (optional)

In **Settings → Power**, set:

* “Automatic suspend” → **Off**
* “Blank screen” → **Never** (if you want it to keep the display when open)

This way, when lid open → you see the screen. When lid closed → machine keeps running headless.

---

### 1.4 Network reliability

* **Best:** Plug in Ethernet if possible.
* If Wi-Fi: set a reserved IP in your router, so you always know where to SSH.

---

# ⚙️ 2. Install Node.js and your project

1. Install Node.js 20.x:

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

   (Check with `node -v`)

2. Clone your project:

   ```bash
   git clone <your-repo-url> ~/li-jobs-ts
   cd ~/li-jobs-ts
   npm ci
   npm run build
   ```

3. Add your LinkedIn cookies into `.env`:

   ```bash
   nano .env
   ```

   ```
   LI_AT=your_li_at
   JSESSIONID=ajax:your_jsession
   ```

---

# 🔄 3. Use PM2 to schedule daily runs

PM2 is a **process manager** for Node apps. Think of it as a helper that:

* Keeps your app running if it crashes.
* Lets you **schedule jobs** with cron syntax.
* Automatically restarts jobs on reboot.
* Handles logging to files.

---

### 3.1 Install PM2

```bash
sudo npm install -g pm2
```

---

### 3.2 Start your job with PM2 + cron schedule

```bash
pm2 start dist/index.js \
  --name li-jobs \
  --cron "0 9 * * *"
```

Breakdown:

* `pm2 start dist/index.js` → runs your built app.
* `--name li-jobs` → gives it a friendly name (you’ll see it in `pm2 list`).
* `--cron "0 9 * * *"` → classic cron expression: run every day at 09:00.

  * Format: `minute hour day month weekday`
  * `0 9 * * *` = 9:00 every day.
* PM2 will *not* keep it running forever; it launches it once at the scheduled time.

---

### 3.3 Save config + auto-start on reboot

```bash
pm2 save
pm2 startup
```

* `pm2 save` → saves your current process list (with names and schedules).
* `pm2 startup` → prints a command to run (copy-paste it). It integrates PM2 with systemd so that when your laptop reboots, PM2 restarts automatically and your schedule survives.

---

### 3.4 Checking status & logs

* See all jobs:

  ```bash
  pm2 list
  ```
* See logs:

  ```bash
  pm2 logs li-jobs
  ```

  Logs are also saved in:

  ```
  ~/.pm2/logs/li-jobs-out.log
  ~/.pm2/logs/li-jobs-error.log
  ```

---

### 3.5 Undoing PM2 setup

* Stop and delete the job:

  ```bash
  pm2 delete li-jobs
  ```
* Remove startup integration:

  ```bash
  pm2 unstartup
  ```
* Uninstall PM2:

  ```bash
  sudo npm uninstall -g pm2
  ```

---

# 📌 4. Best practices

* Put the laptop on a **hard surface** (not a bed). Consider a cheap cooling pad.
* If always plugged in: check BIOS or Pop!\_OS settings for “battery charge limit” (often you can cap at 60–80%).
* Back up results: push your JSON dumps to GitHub, email, or sync to cloud.
* Add an alert (e.g., Healthchecks.io) so you know the script ran successfully.

---

✅ After this, you’ll have:

* A Pop!\_OS laptop that **keeps running with the lid closed**.
* A Node/TypeScript job crawler that runs **daily at 09:00**, supervised by PM2.
* Logs saved automatically, job survives reboots.

---

Do you want me to also prepare a **ready-to-run shell script** that applies all these lid/sleep settings, installs PM2, and sets up your crawler in one go?
