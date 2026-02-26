'use client'

import { useState, useRef, useEffect, useCallback, ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { SYSTEM_PROMPT, AI_CONTRIBUTION_MD } from '@/lib/constants'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Attachment {
  base64: string
  mimeType: string
  previewUrl: string
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const SUGGESTIONS = [
  'Review my Python code',
  'Roast my portfolio site',
  'Is my code spaghetti?',
  'Am I using Git wrong?',
]

const MODELS = [
  { id: 'anthropic/claude-sonnet', label: 'Claude Sonnet' },
  { id: 'google/gemini-flash', label: 'Gemini Flash' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
] as const

function ChefIcon({ size = 24 }: { size?: number }) {
  return (
    <span style={{ fontSize: size * 0.85, lineHeight: 1 }} role="img" aria-label="chef">
      👨‍🍳
    </span>
  )
}

function SendIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function BotIcon() {
  return (
    <div style={{
      width: 28,
      height: 28,
      borderRadius: 8,
      background: '#eff6ff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      color: '#2563eb',
    }}>
      <ChefIcon size={16} />
    </div>
  )
}

function InfoIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function DocIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function PaperclipIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          maxWidth: 640,
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #f0f0f0',
          flexShrink: 0,
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 20,
              color: '#999',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
          >
            &times;
          </button>
        </div>
        <div className="assistant-message" style={{
          padding: '16px 20px',
          overflowY: 'auto',
          fontSize: 14,
          lineHeight: 1.7,
          color: '#333',
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].id)
  const [modal, setModal] = useState<'prompt' | 'contribution' | null>(null)
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [fileError, setFileError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px'
    }
  }, [input])

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFileError('')
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      setFileError('File must be under 5MB')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      setAttachment({
        base64,
        mimeType: file.type,
        previewUrl: result,
      })
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const removeAttachment = useCallback(() => {
    setAttachment(null)
    setFileError('')
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    if ((!content.trim() && !attachment) || isLoading) return

    const userMessage: Message = { role: 'user', content: content.trim() }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    const currentAttachment = attachment
    setAttachment(null)

    try {
      const body: Record<string, unknown> = {
        messages: updatedMessages,
        model: selectedModel,
      }
      if (currentAttachment) {
        body.image = currentAttachment.base64
        body.mimeType = currentAttachment.mimeType
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error('Failed to send message')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      const decoder = new TextDecoder()
      let assistantContent = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            assistantContent += data
            const currentContent = assistantContent
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: currentContent }
              return updated
            })
          }
        }
      }
    } catch {
      setMessages(prev => [
        ...prev.filter(m => !(m.role === 'assistant' && m.content === '')),
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [messages, isLoading, selectedModel, attachment])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearChat = () => {
    setMessages([])
    setInput('')
    setAttachment(null)
  }

  const canSend = (input.trim() || attachment) && !isLoading

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      maxWidth: 720,
      margin: '0 auto',
      padding: '0 20px',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 0',
        borderBottom: '1px solid #f0f0f0',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ color: '#2563eb' }}>
            <ChefIcon size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>
              Chef Code Ramsay
            </h1>
            <p style={{ fontSize: 12.5, color: '#999', marginTop: 1 }}>
              Brutally Honest Code Reviews
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isLoading}
            style={{
              background: '#f7f7f8',
              border: '1px solid #e0e0e0',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 13,
              fontFamily: 'inherit',
              color: '#333',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              outline: 'none',
            }}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#999',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#555')}
              onMouseLeave={e => (e.currentTarget.style.color = '#999')}
            >
              Clear chat
            </button>
          )}
        </div>
      </header>

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 0',
      }}>
        {messages.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 28,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#2563eb', marginBottom: 12 }}>
                <ChefIcon size={40} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 8 }}>
                Hey! I&apos;m Chef Code Ramsay
              </h2>
              <p style={{ color: '#888', fontSize: 15, maxWidth: 420, lineHeight: 1.5 }}>
                Paste your code. I dare you.
              </p>
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'center',
              maxWidth: 560,
            }}>
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  style={{
                    background: '#f7f7f8',
                    border: '1px solid #e8e8eb',
                    color: '#555',
                    padding: '8px 16px',
                    borderRadius: 20,
                    cursor: 'pointer',
                    fontSize: 13,
                    lineHeight: 1.4,
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#eff6ff'
                    e.currentTarget.style.borderColor = '#bfdbfe'
                    e.currentTarget.style.color = '#2563eb'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#f7f7f8'
                    e.currentTarget.style.borderColor = '#e8e8eb'
                    e.currentTarget.style.color = '#555'
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
              <button
                onClick={() => setModal('prompt')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#999',
                  fontSize: 12.5,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#2563eb')}
                onMouseLeave={e => (e.currentTarget.style.color = '#999')}
              >
                <InfoIcon /> View System Prompt
              </button>
              <button
                onClick={() => setModal('contribution')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#999',
                  fontSize: 12.5,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#2563eb')}
                onMouseLeave={e => (e.currentTarget.style.color = '#999')}
              >
                <DocIcon /> View AI Contribution Log
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                {message.role === 'assistant' && <BotIcon />}
                <div
                  className={message.role === 'assistant' ? 'assistant-message' : undefined}
                  style={{
                    maxWidth: '78%',
                    padding: message.role === 'user' ? '10px 16px' : '2px 0',
                    borderRadius: message.role === 'user' ? 18 : 0,
                    background: message.role === 'user' ? '#2563eb' : 'transparent',
                    color: message.role === 'user' ? '#fff' : '#333',
                    fontSize: 14.5,
                    lineHeight: 1.6,
                    wordBreak: 'break-word',
                  }}
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm]}>{message.content}</ReactMarkdown>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <BotIcon />
                <div style={{ paddingTop: 6 }}>
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{
        padding: '12px 0 16px',
        borderTop: '1px solid #f0f0f0',
        flexShrink: 0,
      }}>
        {/* Attachment preview */}
        {attachment && (
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.previewUrl}
                alt="Attachment preview"
                style={{
                  width: 64,
                  height: 64,
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: '1px solid #e0e0e0',
                }}
              />
              <button
                onClick={removeAttachment}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#555',
                  color: '#fff',
                  border: 'none',
                  fontSize: 11,
                  lineHeight: 1,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                &times;
              </button>
            </div>
          </div>
        )}
        {fileError && (
          <p style={{ color: '#dc2626', fontSize: 12.5, marginBottom: 6 }}>{fileError}</p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          gap: 6,
          alignItems: 'flex-end',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: 14,
          padding: '4px 4px 4px 8px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            style={{
              background: 'transparent',
              border: 'none',
              color: attachment ? '#2563eb' : '#bbb',
              cursor: isLoading ? 'default' : 'pointer',
              padding: '8px 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { if (!isLoading) e.currentTarget.style.color = '#2563eb' }}
            onMouseLeave={e => { if (!attachment) e.currentTarget.style.color = '#bbb' }}
          >
            <PaperclipIcon />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste your code or ask me anything..."
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              padding: '10px 0',
              color: '#1a1a1a',
              fontSize: 14.5,
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none',
              lineHeight: 1.5,
            }}
          />
          <button
            type="submit"
            disabled={!canSend}
            style={{
              background: canSend ? '#2563eb' : '#f3f4f6',
              border: 'none',
              borderRadius: 10,
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: canSend ? '#fff' : '#bbb',
              cursor: canSend ? 'pointer' : 'default',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            <SendIcon />
          </button>
        </form>
        <p style={{
          textAlign: 'center',
          fontSize: 11.5,
          color: '#bbb',
          marginTop: 10,
        }}>
          Powered by {MODELS.find(m => m.id === selectedModel)?.label ?? 'AI'} · Where&apos;s the Error Handling?!
        </p>
      </div>

      {/* Modals */}
      {modal === 'prompt' && (
        <Modal title="System Prompt" onClose={() => setModal(null)}>
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 13,
            lineHeight: 1.65,
            background: '#f8f8fa',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #e5e7eb',
          }}>
            {SYSTEM_PROMPT}
          </pre>
        </Modal>
      )}
      {modal === 'contribution' && (
        <Modal title="AI Contribution Log" onClose={() => setModal(null)}>
          <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm]}>{AI_CONTRIBUTION_MD}</ReactMarkdown>
        </Modal>
      )}
    </div>
  )
}
