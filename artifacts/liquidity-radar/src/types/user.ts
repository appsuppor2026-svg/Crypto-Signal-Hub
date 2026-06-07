export interface UserProfile {
  name: string;
  nickname: string;
  email: string;
  phone?: string;
  country: string;
  preferredLanguage: 'es' | 'en';
}
