export type Profile = {id: string; name: string; bio: string; emoji: string};
export type Comment = {id: string; user: string; body: string; created: number};
export type Post = {id: string; user: string; caption: string; created: number; media: {type: string; url: string} | null; likes: number; liked: boolean; comments: Comment[]; ai?: boolean; sample?: boolean};
export type Community = {authProvider?: 'kakao' | 'tester'; me: Profile; profiles: Profile[]; posts: Post[]; following: string[]; followers: string[]; blocked: {id: string; name: string}[]; notifications: {type: string; user: string; post?: string; created: number; body?: string}[]};
