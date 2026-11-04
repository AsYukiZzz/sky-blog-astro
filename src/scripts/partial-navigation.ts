import { swapFunctions } from 'astro:transitions/client';
import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';

const persistentAttribute = 'data-navigation-persist';
const astroPersistentAttribute = 'data-astro-transition-persist';
const reconciledShells = new Set(['nav', 'mobile-nav', 'dock']);
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

function placeNode(parent: Element, node: Node, before: Node | null) {
    if (
        typeof parent.moveBefore === 'function' &&
        parent.isConnected &&
        node.isConnected &&
        node.ownerDocument === parent.ownerDocument
    )
        parent.moveBefore(node, before);
    else parent.insertBefore(node, before);
}

function preparePersistentNodes(incoming: Document) {
    const radioState = [
        ...document.body.querySelectorAll<HTMLInputElement>(
            'input[type="radio"]',
        ),
    ]
        .filter((input) =>
            input.closest(
                `[${persistentAttribute}], [${astroPersistentAttribute}]`,
            ),
        )
        .map((input) => [input, input.checked] as const);
    const targets = new Map(
        [
            ...incoming.body.querySelectorAll(`[${astroPersistentAttribute}]`),
        ].map(
            (node) =>
                [node.getAttribute(astroPersistentAttribute), node] as const,
        ),
    );
    const matched = new Map<Element, Element>();
    for (const node of document.body.querySelectorAll(
        `[${astroPersistentAttribute}]`,
    )) {
        const target = targets.get(node.getAttribute(astroPersistentAttribute));
        if (target) matched.set(node, target);
    }
    const incomingShells = new Map(
        [...incoming.body.querySelectorAll(`[${persistentAttribute}]`)].map(
            (node) => [node.getAttribute(persistentAttribute), node] as const,
        ),
    );
    const pairs = [...matched].filter(([node, target]) => {
        // An outer persistent subtree already owns all its nested state.
        for (
            let parent = node.parentElement;
            parent;
            parent = parent.parentElement
        ) {
            if (matched.get(parent)?.contains(target)) return false;
            const shell = parent.getAttribute(persistentAttribute);
            if (
                shell &&
                !reconciledShells.has(shell) &&
                incomingShells.get(shell)?.contains(target)
            )
                return false;
        }
        // Public body-level roots can stay in place through the local diff.
        const key = nodeKey(node);
        return !(
            node.parentElement === document.body &&
            target.parentElement === incoming.body &&
            key &&
            key === nodeKey(target) &&
            sameKind(node, target)
        );
    });
    // Park matched nodes outside ancestors that the page diff may remove.
    // moveBefore keeps browsing contexts, focus and other native state alive.
    for (const [node] of pairs) placeNode(document.documentElement, node, null);
    return () => {
        for (const [node, target] of pairs) {
            const parent = target.parentElement;
            if (
                !parent ||
                target.ownerDocument !== document ||
                !target.isConnected
            ) {
                node.remove();
                continue;
            }
            placeNode(parent, node, target);
            target.remove();
        }
        // form= can keep a parked radio in the group reset by page defaults.
        for (const [input, checked] of radioState) {
            if (input.isConnected && input.type === 'radio')
                input.checked = checked;
        }
    };
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
            (persistent && !reconciledShells.has(persistent)) ||
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
        if (
            current instanceof HTMLScriptElement ||
            current instanceof HTMLMediaElement
        ) {
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
        if (live !== cursor) placeNode(current, live, cursor);
        live = updateNode(live, target);
        retained.add(live);
        cursor = live.nextSibling;
    }
    for (const child of [...current.childNodes]) {
        if (!retained.has(child)) child.remove();
    }
}

function elementFromMarkup<T extends HTMLElement>(element: T): T {
    // cloneNode also copies dirty form values; create a fresh parsed default.
    const fresh = document.createElement(element.localName) as T;
    for (const { name, value } of element.attributes)
        fresh.setAttribute(name, value);
    fresh.innerHTML = element.innerHTML;
    return fresh;
}

function synchronizePageControls() {
    const selector = 'input, textarea, select';
    for (const control of document.body.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >(selector)) {
        if (
            control.closest(
                `[${persistentAttribute}], [${astroPersistentAttribute}]`,
            )
        )
            continue;
        const defaults = elementFromMarkup(control);
        // Even identical markup can contain user-edited live properties.
        if (
            control instanceof HTMLSelectElement &&
            defaults instanceof HTMLSelectElement
        ) {
            if (control.multiple) {
                [...control.options].forEach(
                    (option, index) =>
                        (option.selected = defaults.options[index].selected),
                );
            } else control.selectedIndex = defaults.selectedIndex;
        } else {
            if (control.value !== defaults.value)
                control.value = defaults.value;
            if (
                control instanceof HTMLInputElement &&
                defaults instanceof HTMLInputElement
            ) {
                control.checked = defaults.checked;
                control.indeterminate = false;
            }
        }
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
        media.replaceWith(elementFromMarkup(media));
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
            const restorePersistentNodes = preparePersistentNodes(incoming);
            updateAttributes(document.body, incoming.body);
            updateChildren(document.body, incoming.body);
            // Restore defaults before persistent radio groups rejoin the page.
            synchronizePageControls();
            restorePersistentNodes();
            initializeContent(document.body, liveMedia);
            restoreFocus();
        };
    });
}
