import { swapFunctions } from 'astro:transitions/client';
import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';

const persistentAttribute = 'data-navigation-persist';
const astroPersistentAttribute = 'data-astro-transition-persist';
const liveBodyAttributes = new Set([
    'data-home-scrolled',
    'data-footer-visible',
    'data-motion-paused',
]);

function nodeKey(node: Node): string | null {
    if (!(node instanceof Element)) return null;
    for (const attribute of [
        persistentAttribute,
        astroPersistentAttribute,
        'data-navigation-key',
        'id',
    ]) {
        const value = node.getAttribute(attribute);
        if (value) return `${attribute}:${value}`;
    }
    return null;
}

function sameKind(current: Node, incoming: Node) {
    return (
        current.nodeType === incoming.nodeType &&
        current.nodeName === incoming.nodeName &&
        (!(current instanceof Element) ||
            !(incoming instanceof Element) ||
            current.namespaceURI === incoming.namespaceURI)
    );
}

function updateAttributes(current: Element, incoming: Element) {
    const keepLiveAttribute = (name: string) =>
        (current === document.body && liveBodyAttributes.has(name)) ||
        (current.matches('.nav-dropdown') && name === 'open');
    for (const attribute of [...current.attributes]) {
        if (
            !incoming.hasAttribute(attribute.name) &&
            !keepLiveAttribute(attribute.name)
        )
            current.removeAttribute(attribute.name);
    }
    for (const { name, value } of [...incoming.attributes]) {
        if (!keepLiveAttribute(name) && current.getAttribute(name) !== value)
            current.setAttribute(name, value);
    }
}

function updateNode(current: Node, incoming: Node): Node {
    if (current === incoming) return current;
    if (!sameKind(current, incoming)) {
        current.parentNode!.replaceChild(incoming, current);
        return incoming;
    }
    if (current instanceof Element && incoming instanceof Element) {
        const persistent = current.getAttribute(persistentAttribute);
        // These subtrees have live state owned by a document-level controller.
        // Navigation and Dock still receive route-specific server attributes.
        if (
            (persistent &&
                !['nav', 'mobile-nav', 'dock'].includes(persistent)) ||
            current.hasAttribute(astroPersistentAttribute)
        )
            return current;
        if (current.isEqualNode(incoming)) return current;
        // A shadow root cannot be reconciled through the host's light DOM.
        if (
            [...incoming.children].some((child) =>
                child.matches('template[shadowrootmode]'),
            )
        ) {
            current.replaceWith(incoming);
            return incoming;
        }
        if (current instanceof HTMLScriptElement) {
            current.replaceWith(incoming);
            return incoming;
        }
        updateAttributes(current, incoming);
        updateChildren(current, incoming);
    } else if (current.nodeValue !== incoming.nodeValue) {
        current.nodeValue = incoming.nodeValue;
    }
    return current;
}

function updateChildren(current: Element, incoming: Element) {
    const keyed = new Map<string, Node>();
    for (const child of [...current.childNodes]) {
        const key = nodeKey(child);
        if (key) keyed.set(key, child);
    }
    const retained = new Set<Node>();
    let cursor = current.firstChild;
    for (const target of [...incoming.childNodes]) {
        const key = nodeKey(target);
        const previous = key
            ? keyed.get(key)
            : cursor && !nodeKey(cursor) && sameKind(cursor, target)
              ? cursor
              : undefined;
        let live = previous && !retained.has(previous) ? previous : target;
        if (live !== cursor) current.insertBefore(live, cursor);
        live = updateNode(live, target);
        retained.add(live);
        cursor = live.nextSibling;
    }
    for (const child of [...current.childNodes]) {
        if (!retained.has(child)) child.remove();
    }
}

function initializeContent(root: ParentNode, liveMedia: Set<HTMLMediaElement>) {
    // DOMParser leaves declarative roots inert. Match Astro's body-swap setup
    // for newly inserted content without disturbing the retained document.
    for (const template of root.querySelectorAll<HTMLTemplateElement>(
        'template[shadowrootmode]',
    )) {
        const mode = template.getAttribute('shadowrootmode');
        const host = template.parentElement;
        if (
            (mode !== 'open' && mode !== 'closed') ||
            !(host instanceof HTMLElement)
        )
            continue;
        if (host.shadowRoot) {
            template.remove();
            continue;
        }
        const shadow = host.attachShadow({ mode });
        shadow.append(template.content);
        template.remove();
        initializeContent(shadow, liveMedia);
    }
    // Parsed media needs a live-document element for resource selection.
    for (const media of root.querySelectorAll<HTMLMediaElement>(
        'video, audio',
    )) {
        if (liveMedia.has(media)) continue;
        const fresh = document.createElement(media.localName);
        for (const { name, value } of media.attributes)
            fresh.setAttribute(name, value);
        fresh.innerHTML = media.innerHTML;
        media.replaceWith(fresh);
    }
}

/** Keep the live document shell while reconciling only changed page nodes. */
export function setupPartialNavigation() {
    document.addEventListener('astro:before-swap', (event) => {
        const transition = event as TransitionBeforeSwapEvent;
        const incoming = transition.newDocument;
        transition.swap = () => {
            const liveMedia = new Set(
                document.querySelectorAll<HTMLMediaElement>('video, audio'),
            );
            for (const dialog of document.querySelectorAll<HTMLDialogElement>(
                'dialog[open]',
            ))
                dialog.close();
            swapFunctions.deselectScripts(incoming);
            swapFunctions.swapRootAttributes(incoming);
            swapFunctions.swapHeadElements(incoming);
            const restoreFocus = swapFunctions.saveFocus();
            updateAttributes(document.body, incoming.body);
            updateChildren(document.body, incoming.body);
            initializeContent(document.body, liveMedia);
            restoreFocus();
        };
    });
}
