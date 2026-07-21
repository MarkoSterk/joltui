export type BlogPost = {
    id: number;
    title: string;
    excerpt: string;
    category: string;
    author: string;
    authorInitials: string;
    publishedAt: string;
    readTime: string;
    featured?: boolean;
    coverClass: string;
    icon: string;
    content: readonly string[];
};

export type DemoUser = {
    name: string;
    email: string;
    role: string;
    initials: string;
};
