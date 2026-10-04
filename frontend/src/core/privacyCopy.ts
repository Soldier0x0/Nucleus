export const PRIVACY_STAYS = "Your records, photos, bills, and cycle dates stay in the encrypted file on this phone.";

export const PRIVACY_NEVER = "Records, photos, cycle dates, and bank lines stay on this phone. A locked backup leaves only when you tap Sign in and store this file. Online weather sends the place you saved, not the rest of the file.";

export const PRIVACY_PERMISSIONS: { name: string; line: string }[] = [
  { name: "Fingerprint or face", line: "Unlock this app." },
  { name: "Notifications", line: "Reminders you asked for, and the emergency card while that switch is on." },
  { name: "Notification access", line: "Read bank lines from the bank app. Codes are dropped." },
  { name: "Photos", line: "A picture you choose for a receipt, a bill, or a cover." },
  { name: "Location", line: "One reading for weather, then it stops. Nucleus cannot turn the phone's location switch on or off." },
];
