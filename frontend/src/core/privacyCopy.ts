export const PRIVACY_STAYS = "Your vehicles, money, trips, notes, photos, papers, bills, and cycle dates stay in the encrypted file on this phone.";

export const PRIVACY_NEVER = "Vehicles, money, photos, cycle dates, and bank lines stay on this phone. Nucleus has no account. Bank lines come from notifications, not SMS. A locked backup leaves only when you tap Sign in and store this file. Online weather sends the place you saved, and leaves the rest of the file here.";

export const PRIVACY_PERMISSIONS: { name: string; line: string }[] = [
  { name: "Fingerprint or face", line: "Unlocks this app. The phone keeps the print or the face." },
  { name: "Notifications", line: "Reminders you asked for, and the emergency card while that switch is on." },
  { name: "Notification access", line: "Reads bank lines from Google Pay, PhonePe, and bank notifications once you turn access on. Codes are dropped. Nucleus does not turn the permission on." },
  { name: "Photos", line: "A picture you choose for a receipt, a bill, or a cover. The picture stays in the file on this phone." },
  { name: "Location", line: "One reading for weather, then it stops. Nucleus cannot turn the phone's location switch on or off." },
  { name: "Screenshots", line: "While Block screenshots is on, this app stays out of screenshots and the recent-apps list. A screenshot while the phone is unlocked does not ask for a PIN." },
];
