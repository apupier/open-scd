import { html, TemplateResult } from 'lit-element';
import { translate, get } from 'lit-translate';

import '@material/mwc-checkbox';
import '@material/mwc-switch';
import '@material/mwc-formfield';
import '@material/mwc-list/mwc-list-item';
import '@material/mwc-list/mwc-check-list-item';
import '@material/mwc-icon';
import { Checkbox } from '@material/mwc-checkbox';
import { List } from '@material/mwc-list';
import { ListItemBase } from '@material/mwc-list/mwc-list-item-base';

import '../../../wizard-textfield.js';
import '../../../filtered-list.js';
import {
  pTypes104,
  stationTypeOptions,
  typeDescriptiveNameKeys,
  typePattern
} from '../foundation/p-types.js';
import {
  compareNames,
  ComplexAction,
  createElement,
  EditorAction,
  getValue,
  identity,
  isPublic,
  newSubWizardEvent,
  newWizardEvent,
  Wizard,
  WizardActor,
  WizardInputElement
} from '../../../foundation.js';
import {
  createTypeRestrictionCheckbox
} from '../../../wizards/connectedap.js';
import { SingleSelectedEvent } from '@material/mwc-list/mwc-list-foundation';
import { editRedundancyGroup104Wizard } from './redundancygroup.js';
import { ifDefined } from 'lit-html/directives/if-defined';
import { typeMaxLength, typeNullable } from '../../../wizards/foundation/p-types.js';

interface AccessPointDescription {
  element: Element;
  connected?: boolean;
}

/** Sorts connected `AccessPoint`s to the bottom. */
function compareAccessPointConnection(
  a: AccessPointDescription,
  b: AccessPointDescription
): number {
  if (a.connected !== b.connected) return b.connected ? -1 : 1;
  return 0;
}

function createConnectedApAction(parent: Element): WizardActor {
  return (
    _: WizardInputElement[],
    __: Element,
    list?: List | null
  ): EditorAction[] => {
    if (!list) return [];

    const identities = (<ListItemBase[]>list.selected).map(item => item.value);

    const actions = identities.map(identity => {
      const [iedName, apName] = identity.split('>');

      return {
        new: {
          parent,
          element: createElement(parent.ownerDocument, 'ConnectedAP', {
            iedName,
            apName,
          }),
        },
      };
    });

    return actions;
  };
}

function existConnectedAp(accesspoint: Element): boolean {
  const iedName = accesspoint.closest('IED')?.getAttribute('name');
  const apName = accesspoint.getAttribute('name');

  const connAp = accesspoint.ownerDocument.querySelector(
    `ConnectedAP[iedName="${iedName}"][apName="${apName}"]`
  );

  return (connAp && isPublic(connAp)) ?? false;
}

/** @returns single page  [[`Wizard`]] for creating SCL element ConnectedAP. */
export function createConnectedAp104Wizard(element: Element): Wizard {
  const doc = element.ownerDocument;

  const accessPoints = Array.from(doc.querySelectorAll(':root > IED'))
    .sort(compareNames)
    .flatMap(ied =>
      Array.from(ied.querySelectorAll(':root > IED > AccessPoint'))
    )
    .map(accesspoint => {
      return {
        element: accesspoint,
        connected: existConnectedAp(accesspoint),
      };
    })
    .sort(compareAccessPointConnection);

  return [
    {
      title: get('wizard.title.add', { tagName: 'ConnectedAP' }),
      primary: {
        icon: 'save',
        label: get('save'),
        action: createConnectedApAction(element),
      },
      content: [
        html` <filtered-list id="apList" multi
          >${accessPoints.map(accesspoint => {
          const id = identity(accesspoint.element);

          return html`<mwc-check-list-item
              value="${id}"
              ?disabled=${accesspoint.connected}
              ><span>${id}</span></mwc-check-list-item
            >`;
        })}
        </filtered-list>`,
      ],
    },
  ];
}

function isEqualAddress(oldAddress: Element, newAddress: Element): boolean {
  return Array.from(oldAddress.querySelectorAll('Address > P')).every(pType =>
    newAddress
      .querySelector(`Address > P[type="${pType.getAttribute('type')}"]`)
      ?.isEqualNode(pType)
  );
}

function createAddressElement(
  inputs: WizardInputElement[],
  parent: Element,
  typeRestriction: boolean
): Element {
  const element = createElement(parent.ownerDocument, 'Address', {});

  inputs
    .filter(input => getValue(input) !== null)
    .forEach(validInput => {
      const type = validInput.label;
      const child = createElement(parent.ownerDocument, 'P', { type });

      if (typeRestriction)
        child.setAttributeNS(
          'http://www.w3.org/2001/XMLSchema-instance',
          'xsi:type',
          'tP_' + type
        );

      child.textContent = getValue(validInput);
      element.appendChild(child);
    });

  return element;
}

export function updateConnectedApAction(parent: Element, redundancy?: boolean): WizardActor {
  return (inputs: WizardInputElement[], wizard: Element): EditorAction[] => {
    const typeRestriction: boolean =
      (<Checkbox>wizard.shadowRoot?.querySelector('#typeRestriction'))
        ?.checked ?? false;

    const newAddress = createAddressElement(inputs, parent, typeRestriction);
    const oldAddress = parent.querySelector('Address');

    const complexAction: ComplexAction = {
      actions: [],
      title: get('connectedap.action.addaddress', {
        iedName: parent.getAttribute('iedName') ?? '',
        apName: parent.getAttribute('apName') ?? '',
      }),
    };
    // When we have a redundanct ConnectedAP, we are only interested in the StationType value.
    // All redundancy group actions are done in those wizards itself.
    if (redundancy) {
      const stationTypeValue = getValue(inputs.find(i => i.label === 'StationType')!)!;
      const stationTypeElement = oldAddress?.querySelector('P[type="StationType"]');
      stationTypeElement!.textContent = stationTypeValue;

      complexAction.actions.push({
        new: {
          parent: parent,
          element: oldAddress!,
        },
      });
    } else if (oldAddress !== null && !isEqualAddress(oldAddress, newAddress)) {
      //address & child elements P are changed: cannot use replace editor action
      complexAction.actions.push({
        old: {
          parent,
          element: oldAddress,
        },
      });
      complexAction.actions.push({
        new: {
          parent,
          element: newAddress,
        },
      });
    } else if (oldAddress === null)
      complexAction.actions.push({
        new: {
          parent: parent,
          element: newAddress,
        },
      });

    return complexAction.actions.length ? [complexAction] : [];
  };
}

function getRedundancyGroupNumbers(element: Element): number[] {
  const groupNumbers = [];
  let groupNumber = 1;

  while (element.querySelectorAll(`Address > P[type^="RG${groupNumber}"]`).length >= 8) {
    groupNumbers.push(groupNumber++);
  }

  return groupNumbers;
}

export function createPTextField(element: Element, pType: string): TemplateResult {
  return html`<wizard-textfield
    required
    label="${pType}"
    pattern="${ifDefined(typePattern[pType])}"
    ?nullable=${typeNullable[pType]}
    .maybeValue=${element.querySelector(
      `Address > P[type="${pType}"]`
    )?.innerHTML ?? null}
    maxLength="${ifDefined(typeMaxLength[pType])}"
  ></wizard-textfield>`
}

/** @returns single page [[`Wizard`]] to edit SCL element ConnectedAP for the 104 plugin. */
export function editConnectedAp104Wizard(element: Element, redundancy?: boolean): Wizard {
  return [
    {
      title: get('wizard.title.edit', { tagName: element.tagName }),
      element,
      primary: {
        icon: 'save',
        label: get('save'), 
        action: updateConnectedApAction(element, redundancy),
      },
      content: [
        html`<mwc-formfield label="${get('protocol104.network.connectedap.redundancy.title')}">
          <mwc-switch
            id="redundancy"
            ?checked=${redundancy}
            @change=${() => {
              document.querySelector('open-scd')!.dispatchEvent(newWizardEvent());
              document.querySelector('open-scd')!.dispatchEvent(
                newWizardEvent(
                  editConnectedAp104Wizard(
                    element,
                    !redundancy
                  )
                )
              );
            }}
          ></mwc-switch>
        </mwc-formfield>
        <wizard-divider></wizard-divider>
        ${createTypeRestrictionCheckbox(element)}
        <wizard-select
          label="StationType"
          .maybeValue=${element.querySelector(
            `Address > P[type="StationType"]`
          )?.innerHTML ?? null}
          required
          fixedMenuPosition
          helper="${translate(typeDescriptiveNameKeys["StationType"])}"
        >
          ${stationTypeOptions.map(
            option => html`<mwc-list-item value="${option}">${option}</mwc-list-item>`
          )}
        </wizard-select>
        ${redundancy
          ? html`<h3>${get('protocol104.network.connectedap.redundancy.groupTitle')}</h3>
            <mwc-list
              @selected=${(e: SingleSelectedEvent) => {
                e.target!.dispatchEvent(
                  newSubWizardEvent(
                    editRedundancyGroup104Wizard(element.querySelector('Address')!, e.detail.index+1)
                  )
                );
              }}>
              ${getRedundancyGroupNumbers(element).map(
                number => html`<mwc-list-item>Redundancy Group ${number}</mwc-list-item>`
              )}
            </mwc-list>`
          : html`${pTypes104.map(
            pType => html`${createPTextField(element, pType)}`
          )}`}
        `,
      ],
    },
  ];
}
