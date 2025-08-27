import { IRenderer, IRendererRegistry } from './interfaces';

/**
 * Global renderer registry for managing custom renderers
 */
class RendererRegistry implements IRendererRegistry {
    private renderers: Map<string, IRenderer> = new Map();
    
    register(renderer: IRenderer): void {
        if (this.renderers.has(renderer.id)) {
            console.warn(`Renderer with id "${renderer.id}" is already registered. It will be overwritten.`);
        }
        this.renderers.set(renderer.id, renderer);
    }
    
    get(id: string): IRenderer | undefined {
        return this.renderers.get(id);
    }
    
    getAll(): IRenderer[] {
        return Array.from(this.renderers.values());
    }
    
    has(id: string): boolean {
        return this.renderers.has(id);
    }
    
    unregister(id: string): void {
        this.renderers.delete(id);
    }
}

// Global singleton instance
export const rendererRegistry = new RendererRegistry();

/**
 * Helper function to register a renderer
 */
export function registerRenderer(renderer: IRenderer): void {
    rendererRegistry.register(renderer);
}

/**
 * Helper function to get a renderer
 */
export function getRenderer(id: string): IRenderer | undefined {
    return rendererRegistry.get(id);
}

/**
 * Helper function to get all renderers
 */
export function getAllRenderers(): IRenderer[] {
    return rendererRegistry.getAll();
}