export const environment = {
  production: true,
  supabase: {
    url: 'https://your-project-id.supabase.co',
    anonKey: 'your-anon-key-here',
  },

  // PWA Configuration
  notifications: {
    vapidPublicKey: 'your-vapid-public-key',
  },

  // External APIs
  roadmapSh: {
    baseUrl: 'https://roadmap.sh',
  },
};
