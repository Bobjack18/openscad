// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { CSSProperties, useContext, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { MenuItem } from 'primereact/menuitem';
import { Menu } from 'primereact/menu';
import { ModelContext } from './contexts.ts';
import { isInStandaloneMode } from '../utils.ts';
import { confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';

export default function SettingsMenu({className, style}: {className?: string, style?: CSSProperties}) {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');
  const state = model.state;

  const settingsMenu = useRef<Menu>(null);
  const [apiKeyDialogVisible, setApiKeyDialogVisible] = useState(false)
  const [tempApiKey, setTempApiKey] = useState('')

  const saveApiKey = () => {
    model.mutate(s => {
      if (!s.ai) s.ai = {}
      s.ai.geminiApiKey = tempApiKey
    })
    setApiKeyDialogVisible(false)
    setTempApiKey('')
  }
  return (
    <>
      <Menu model={[
        {
          label: state.view.layout.mode === 'multi'
            ? 'Switch to single panel mode'
            : "Switch to side-by-side mode",
          icon: 'pi pi-table',
          // disabled: true,
          command: () => model.changeLayout(state.view.layout.mode === 'multi' ? 'single' : 'multi'),
        },
        {
          separator: true
        },  
        {
          label: state.view.showAxes ? 'Hide axes' : 'Show axes',
          icon: 'pi pi-asterisk',
          // disabled: true,
          command: () => model.mutate(s => s.view.showAxes = !s.view.showAxes)
        },
        {
          label: state.view.lineNumbers ? 'Hide line numbers' : 'Show line numbers',
          icon: 'pi pi-list',
          // disabled: true,
          command: () => model.mutate(s => s.view.lineNumbers = !s.view.lineNumbers)
        },
        {
          separator: true
        },
        {
          label: state.ai?.geminiApiKey ? 'Update AI API Key' : 'Configure AI API Key',
          icon: 'pi pi-key',
          command: () => {
            setTempApiKey(state.ai?.geminiApiKey || '')
            setApiKeyDialogVisible(true)
          }
        },
        ...(isInStandaloneMode() ? [
          {
            separator: true
          },  
          {
            label: 'Clear local storage',
            icon: 'pi pi-list',
            // disabled: true,
            command: () => {
              confirmDialog({
                message: "This will clear all the edits you've made and files you've created in this playground " +
                  "and will reset it to factory defaults. " +
                  "Are you sure you wish to proceed? (you might lose your models!)",
                header: 'Clear local storage',
                icon: 'pi pi-exclamation-triangle',
                accept: () => {
                  localStorage.clear();
                  location.reload();
                },
                acceptLabel: `Clear all files!`,
                rejectLabel: 'Cancel'
              });
            },
          },
        ] : []),
      ] as MenuItem[]} popup ref={settingsMenu} />
    
      <Button title="Settings menu"
          style={style}
          className={className}
          rounded
          text
          icon="pi pi-cog"
          onClick={(e) => settingsMenu.current && settingsMenu.current.toggle(e)} />

      <Dialog
        header="Configure Gemini API Key"
        visible={apiKeyDialogVisible}
        style={{ width: '450px' }}
        onHide={() => setApiKeyDialogVisible(false)}
        footer={
          <div>
            <Button label="Cancel" icon="pi pi-times" onClick={() => setApiKeyDialogVisible(false)} text />
            <Button label="Save" icon="pi pi-check" onClick={saveApiKey} disabled={!tempApiKey.trim()} />
          </div>
        }
      >
        <div className="flex flex-column gap-3">
          <p style={{ marginTop: 0 }}>
            Enter your Google Gemini API key. Get one at{' '}
            <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
              Google AI Studio
            </a>
          </p>
          <InputText
            value={tempApiKey}
            onChange={(e) => setTempApiKey(e.target.value)}
            placeholder="Enter API key..."
            type="password"
            style={{ width: '100%' }}
          />
          <small style={{ color: 'var(--text-color-secondary)' }}>
            Your API key is stored locally in your browser.
          </small>
        </div>
      </Dialog>
    </>
  );
}