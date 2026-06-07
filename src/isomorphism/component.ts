import { el } from "./utils";
const space = require("to-space-case");

// Lazy import: only loaded in renderer context (webview)
function requireIncrementalDom() {
    return require("incremental-dom");
}

export interface Component {
    render(): void;
}

export interface WindowComponent extends Component {
    onClose(): void;
}

export class ButtonComponent implements Component {
    constructor(public name: string, public key: string, public onclick: () => void) {}

    render() {
        const { text } = requireIncrementalDom();
        el`div :key=${this.key} *class="svgeditor-button" onclick=${this.onclick}`;
        text(this.name);
        el`/div`;
    }
}

export function iconComponent(title: string, href: string, onclick: (event: Event) => void) {
    el`div *title=${space(title)} style="display: inline-block; width: 32px; height: 32px;"`;
        el`svg *class="svgeditor-icon" *x="25%" *y="25%" *width="50%" *height="50%" *viewBox="0 0 20 20" onclick.stop=${onclick}`;
            el`use xlink:href=${href} /`;
        el`/svg`;
    el`/div`;
}
