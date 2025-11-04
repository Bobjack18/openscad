// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { CSSProperties, useContext, useRef, useState } from 'react';
import Editor, { loader, Monaco } from '@monaco-editor/react';
import openscadEditorOptions from '../language/openscad-editor-options.ts';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { MenuItem } from 'primereact/menuitem';
import { Menu } from 'primereact/menu';
import { buildUrlForStateParams } from '../state/fragment-state.ts';
import { getBlankProjectState, defaultSourcePath } from '../state/initial-state.ts';
import { ModelContext, FSContext } from './contexts.ts';
import FilePicker, {  } from './FilePicker.tsx';
import { GeminiService, Message } from '../services/GeminiService.ts';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { confirmDialog } from 'primereact/confirmdialog';

// const isMonacoSupported = false;
const isMonacoSupported = (() => {
  const ua = window.navigator.userAgent;
  const iosWk = ua.match(/iPad|iPhone/i) && ua.match(/WebKit/i);
  return !iosWk;
})();

let monacoInstance: Monaco | null = null;
if (isMonacoSupported) {
  loader.init().then(mi => monacoInstance = mi);
}

export default function EditorPanel({className, style}: {className?: string, style?: CSSProperties}) {

  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');

  const menu = useRef<Menu>(null);

  const state = model.state;

  const [editor, setEditor] = useState(null as monaco.editor.IStandaloneCodeEditor | null)
  const [aiChatVisible, setAiChatVisible] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [apiKeyDialogVisible, setApiKeyDialogVisible] = useState(false)
  const [tempApiKey, setTempApiKey] = useState('')

  if (editor) {
    const checkerRun = state.lastCheckerRun;
    const editorModel = editor.getModel();
    if (editorModel) {
      if (checkerRun && monacoInstance) {
        monacoInstance.editor.setModelMarkers(editorModel, 'openscad', checkerRun.markers);
      }
    }
  }

  const handleAiRequest = async () => {
    if (!aiPrompt.trim()) return

    const apiKey = state.ai?.geminiApiKey
    if (!apiKey) {
      setApiKeyDialogVisible(true)
      return
    }

    setAiLoading(true)
    try {
      const gemini = new GeminiService(apiKey)
      const history: Message[] = state.ai?.conversationHistory || []
      const response = await gemini.generateOpenSCAD(aiPrompt, model.source, history)

      confirmDialog({
        message: `${response.explanation}\n\nApply this code to the editor?`,
        header: 'AI Generated Code',
        icon: 'pi pi-sparkles',
        accept: () => {
          model.source = response.code
          model.mutate(s => {
            if (!s.ai) s.ai = {}
            if (!s.ai.conversationHistory) s.ai.conversationHistory = []
            s.ai.conversationHistory.push(
              { role: 'user', content: aiPrompt },
              { role: 'assistant', content: response.explanation, code: response.code }
            )
          })
        },
        acceptLabel: 'Apply Code',
        rejectLabel: 'Cancel'
      })

      setAiPrompt('')
    } catch (error) {
      alert(`AI Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setAiLoading(false)
    }
  }

  const saveApiKey = () => {
    model.mutate(s => {
      if (!s.ai) s.ai = {}
      s.ai.geminiApiKey = tempApiKey
    })
    setApiKeyDialogVisible(false)
    setTempApiKey('')
  }

  const onMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editor.addAction({
      id: "openscad-render",
      label: "Render OpenSCAD",
      run: () => model.render({isPreview: false, now: true})
    });
    editor.addAction({
      id: "openscad-preview",
      label: "Preview OpenSCAD",
      run: () => model.render({isPreview: true, now: true})
    });
    editor.addAction({
      id: "openscad-save-do-nothing",
      label: "Save (disabled)",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => {}
    });
    editor.addAction({
      id: "openscad-save-project",
      label: "Save OpenSCAD project",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS],
      run: () => model.saveProject()
    });
    setEditor(editor)
  }

  return (
    <div className={`editor-panel ${className ?? ''}`} style={{
      // maxWidth: '5 0vw',
      display: 'flex',
      flexDirection: 'column',
      // position: 'relative',
      // width: '100%', height: '100%',
      ...(style ?? {})
    }}>
      <div className='flex flex-row gap-2' style={{
        margin: '5px',
      }}>
          
        <Menu model={[
          {
            label: "New project",
            icon: 'pi pi-plus-circle',
            command: () => window.open(buildUrlForStateParams(getBlankProjectState()), '_blank'),
            target: '_blank',
          },
          {
            // TODO: share text, title and rendering image
            // https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
            label: 'Share project',
            icon: 'pi pi-share-alt',
            disabled: true,
          },
          {
            separator: true
          },  
          {
            // TODO: popup to ask for file name
            label: "New file",
            icon: 'pi pi-plus',
            disabled: true,
          },
          {
            label: "Copy to new file",
            icon: 'pi pi-clone',
            disabled: true,
          },
          {
            label: "Upload file(s)",
            icon: 'pi pi-upload',
            disabled: true,
          },
          {
            label: 'Download sources',
            icon: 'pi pi-download',
            disabled: true,
          },
          {
            separator: true
          },
          {
            separator: true
          },
          {
            label: 'Select All',
            icon: 'pi pi-info-circle',
            command: () => editor?.trigger(state.params.activePath, 'editor.action.selectAll', null),
          },
          {
            separator: true
          },
          {
            label: 'Find',
            icon: 'pi pi-search',
            command: () => editor?.trigger(state.params.activePath, 'actions.find', null),
          },
        ] as MenuItem[]} popup ref={menu} />
        <Button title="Editor menu" rounded text icon="pi pi-ellipsis-h" onClick={(e) => menu.current && menu.current.toggle(e)} />
        
        <FilePicker 
            style={{
              flex: 1,
            }}/>

        {state.params.activePath !== defaultSourcePath && 
          <Button icon="pi pi-chevron-left" 
          text
          onClick={() => model.openFile(defaultSourcePath)} 
          title={`Go back to ${defaultSourcePath}`}/>}

        <Button 
          icon="pi pi-sparkles" 
          text
          rounded
          onClick={() => setAiChatVisible(!aiChatVisible)} 
          title="AI Assistant"
          className={aiChatVisible ? 'p-button-info' : ''} />

      </div>

      
      <div style={{
        position: 'relative',
        flex: 1
      }}>
        {isMonacoSupported && (
          <Editor
            className="openscad-editor absolute-fill"
            defaultLanguage="openscad"
            path={state.params.activePath}
            value={model.source}
            onChange={s => model.source = s ?? ''}
            onMount={onMount} // TODO: This looks a bit silly, does it trigger a re-render??
            options={{
              ...openscadEditorOptions,
              fontSize: 16,
              lineNumbers: state.view.lineNumbers ? 'on' : 'off',
            }}
          />
        )}
        {!isMonacoSupported && (
          <InputTextarea 
            className="openscad-editor absolute-fill"
            value={model.source}
            onChange={s => model.source = s.target.value ?? ''}  
          />
        )}
      </div>

      <div style={{
        display: state.view.logs ? undefined : 'none',
        overflowY: 'scroll',
        height: 'calc(min(200px, 30vh))',
      }}>
        {(state.currentRunLogs ?? []).map(([type, text], i) => (
          <pre key={i}>{text}</pre>
        ))}
      </div>

      {aiChatVisible && (
        <div style={{
          borderTop: '1px solid var(--surface-border)',
          padding: '10px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          backgroundColor: 'var(--surface-card)'
        }}>
          <InputText
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !aiLoading && handleAiRequest()}
            placeholder="Ask AI to generate or modify OpenSCAD code..."
            disabled={aiLoading}
            style={{ flex: 1 }}
          />
          <Button
            icon="pi pi-send"
            onClick={handleAiRequest}
            disabled={aiLoading || !aiPrompt.trim()}
            loading={aiLoading}
            label="Send"
          />
          {!state.ai?.geminiApiKey && (
            <Button
              icon="pi pi-key"
              onClick={() => setApiKeyDialogVisible(true)}
              label="Set API Key"
              severity="warning"
              outlined
            />
          )}
        </div>
      )}

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
    
    </div>
  )
}
