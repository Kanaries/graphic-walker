import { inject } from '@vercel/analytics';
import { embedGraphicWalker } from './vanilla';

if (!import.meta.env.DEV) {
    inject();
}

embedGraphicWalker(document.getElementById('root') as HTMLElement, {})