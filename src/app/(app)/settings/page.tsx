'use client'
// This page exists only to trigger the settings modal via the Sidebar pathname detection.
// The Sidebar (from AppLayout) detects pathname === '/settings' and opens the modal.
// On close, the Sidebar navigates back to /feed.
export default function SettingsPage() {
  return null
}
