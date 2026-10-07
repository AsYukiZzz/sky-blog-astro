import { links as configuredLinks } from '../data/index';

export const defaultFriendLogo = '/images/friend-default.webp';

export const links = configuredLinks.map((link) => ({
    ...link,
    logo: link.logo?.trim() || defaultFriendLogo,
}));
