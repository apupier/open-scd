import {
  html,
  LitElement,
  TemplateResult,
  property,
  customElement,
  state,
  css,
  query,
} from 'lit-element';

import '../../action-pane.js';
import './sub-function-editor.js';
import {
  getChildElementsByTagName,
  newWizardEvent,
  SCLTag,
  tags,
} from '../../foundation.js';
import { translate } from 'lit-translate';
import { emptyWizard, wizards } from '../../wizards/wizard-library.js';
import { Menu } from '@material/mwc-menu';
import { ListItem } from '@material/mwc-list/mwc-list-item';
import { IconButton } from '@material/mwc-icon-button';

function childTags(element: Element | null | undefined): SCLTag[] {
  if (!element) return [];

  return tags[<SCLTag>element.tagName].children.filter(
    child => wizards[child].create !== emptyWizard
  );
}

/** Pane rendering `Function` element with its children */
@customElement('function-editor')
export class FunctionEditor extends LitElement {
  /** The edited `Function` element */
  @property({ attribute: false })
  element!: Element;
  @state()
  private get header(): string {
    const name = this.element.getAttribute('name');
    const desc = this.element.getAttribute('desc');
    const type = this.element.getAttribute('type');

    return `${name}${desc ? ` - ${desc}` : ''}${type ? ` (${type})` : ''}`;
  }

  @query('mwc-menu') addMenu!: Menu;
  @query('mwc-icon-button[icon="playlist_add"]') addButton!: IconButton;

  private openCreateWizard(tagName: string): void {
    const wizard = wizards[<SCLTag>tagName].create(this.element!);

    if (wizard) this.dispatchEvent(newWizardEvent(wizard));
  }

  firstUpdated(): void {
    this.addMenu.anchor = <HTMLElement>this.addButton;
  }

  private renderLNodes(): TemplateResult {
    const lNodes = getChildElementsByTagName(this.element, 'LNode');

    return lNodes.length
      ? html`<div class="container lnode">
          ${lNodes.map(
            lNode => html`<l-node-editor .element=${lNode}></l-node-editor>`
          )}
        </div>`
      : html``;
  }

  private renderSubFunctions(): TemplateResult {
    const subfunctions = getChildElementsByTagName(this.element, 'SubFunction');
    return html` ${subfunctions.map(
      subFunction =>
        html`<sub-function-editor
          .element=${subFunction}
        ></sub-function-editor>`
    )}`;
  }

  private renderAddButtons(): TemplateResult[] {
    return childTags(this.element).map(
      child =>
        html`<mwc-list-item value="${child}"
          ><span>${child}</span></mwc-list-item
        >`
    );
  }

  render(): TemplateResult {
    return html`<action-pane
      label="${this.header}"
      icon="functions"
      secondary
      highlighted
      ><abbr
        slot="action"
        style="position:relative;"
        title="${translate('add')}"
      >
        <mwc-icon-button
          icon="playlist_add"
          @click=${() => (this.addMenu.open = true)}
        ></mwc-icon-button
        ><mwc-menu
          corner="BOTTOM_RIGHT"
          menuCorner="END"
          @selected=${(e: Event) => {
            const tagName = (<ListItem>(<Menu>e.target).selected).value;
            this.openCreateWizard(tagName);
          }}
          >${this.renderAddButtons()}</mwc-menu
        > </abbr
      >${this.renderLNodes()}${this.renderSubFunctions()}</action-pane
    >`;
  }

  static styles = css`
    .container.lnode {
      display: grid;
      grid-gap: 12px;
      padding: 8px 12px 16px;
      box-sizing: border-box;
      grid-template-columns: repeat(auto-fit, minmax(64px, auto));
    }
  `;
}
