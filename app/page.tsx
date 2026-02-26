'use client'

import { useState, useRef, useEffect, useCallback, ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { SYSTEM_PROMPT, AI_CONTRIBUTION_MD, FEATURES_MD } from '@/lib/constants'
import { checkContentFilter, INPUT_BLOCKED_MESSAGE, OUTPUT_BLOCKED_MESSAGE, SAFETY_POLICY_MD } from '@/lib/filters'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Attachment {
  base64: string
  mimeType: string
  previewUrl: string
  fileName?: string
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024   // 5MB
const MAX_PDF_SIZE = 10 * 1024 * 1024    // 10MB
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']

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

function ChevronIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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
      className="modal-overlay"
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
        className="modal-content"
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
          <button onClick={onClose} className="modal-close-btn">
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
  const [authenticated, setAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [userName, setUserName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].id)
  const [modal, setModal] = useState<'prompt' | 'contribution' | 'safety' | 'features' | null>(null)
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [fileError, setFileError] = useState('')
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const modelPickerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Check sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAuth = sessionStorage.getItem('chef_auth') === '1'
      setAuthenticated(isAuth)
      if (isAuth) {
        setUserName(sessionStorage.getItem('chef_user') || '')
      }
    }
    setAuthChecked(true)
  }, [])

  // Focus name input when login screen shows
  useEffect(() => {
    if (authChecked && !authenticated) {
      nameInputRef.current?.focus()
    }
  }, [authChecked, authenticated])

  const handleLogin = useCallback((e: FormEvent) => {
    e.preventDefault()
    if (!nameInput.trim() || !password.trim()) {
      setAuthError('Please enter your name and password')
      return
    }
    const name = nameInput.trim()
    sessionStorage.setItem('chef_auth', '1')
    sessionStorage.setItem('chef_user', name)
    setUserName(name)
    setAuthenticated(true)
  }, [nameInput, password])

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours()
    const name = userName || 'Chef'
    if (hour < 12) return `Good morning, ${name}! Ready to cook up some code?`
    if (hour < 17) return `Good afternoon, ${name}! Let\u2019s get coding!`
    return `Good evening, ${name}! Late night coding session?`
  }, [userName])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setModelPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

    const isPdf = file.type === 'application/pdf'
    const maxSize = isPdf ? MAX_PDF_SIZE : MAX_IMAGE_SIZE

    if (file.size > maxSize) {
      setFileError(isPdf ? 'PDF must be under 10MB' : 'Image must be under 5MB')
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
        fileName: isPdf ? file.name : undefined,
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

    // --- Block PDF with OpenAI (not supported) ---
    if (attachment?.mimeType === 'application/pdf' && selectedModel === 'openai/gpt-4o-mini') {
      setFileError('PDF analysis is only available with Claude and Gemini')
      return
    }

    // --- Input filter (frontend) ---
    if (content.trim() && checkContentFilter(content.trim())) {
      const userMessage: Message = { role: 'user', content: content.trim() }
      setMessages(prev => [
        ...prev,
        userMessage,
        { role: 'assistant', content: INPUT_BLOCKED_MESSAGE },
      ])
      setInput('')
      return
    }

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
            try { assistantContent += JSON.parse(data) } catch { assistantContent += data }
            const currentContent = assistantContent
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: currentContent }
              return updated
            })
          }
        }
      }

      // --- Output filter (frontend check after streaming completes) ---
      if (checkContentFilter(assistantContent)) {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: OUTPUT_BLOCKED_MESSAGE }
          return updated
        })
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

  // Don't render anything until sessionStorage check completes
  if (!authChecked) return null

  // Login screen
  if (!authenticated) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(180deg, rgba(239, 246, 255, 0.5) 0%, #fff 50%)',
      }}>
        <div className="modal-content" style={{
          background: '#fff',
          borderRadius: 16,
          padding: '40px 36px 36px',
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          border: '1px solid #f0f0f0',
          textAlign: 'center',
        }}>
          <div style={{ color: '#2563eb', marginBottom: 12 }}>
            <ChefIcon size={44} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 4 }}>
            Chef Code Ramsay
          </h1>
          <p style={{ color: '#999', fontSize: 13.5, marginBottom: 28 }}>
            Sign in to enter the kitchen
          </p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              ref={nameInputRef}
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="Your name"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 10,
                border: '1px solid #e0e0e0',
                fontSize: 15,
                fontFamily: 'inherit',
                outline: 'none',
                color: '#1a1a1a',
                background: '#fff',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#bfdbfe')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e0e0e0')}
            />
            <div>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setAuthError('') }}
                placeholder="Password"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: 10,
                  border: `1px solid ${authError ? '#fca5a5' : '#e0e0e0'}`,
                  fontSize: 15,
                  fontFamily: 'inherit',
                  outline: 'none',
                  color: '#1a1a1a',
                  background: '#fff',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={e => { if (!authError) e.currentTarget.style.borderColor = '#bfdbfe' }}
                onBlur={e => { if (!authError) e.currentTarget.style.borderColor = '#e0e0e0' }}
              />
            </div>
            {authError && (
              <p style={{ color: '#dc2626', fontSize: 13, margin: 0, textAlign: 'left' }}>
                {authError}
              </p>
            )}
            <button
              type="submit"
              disabled={!nameInput.trim() || !password.trim()}
              style={{
                width: '100%',
                padding: '11px 0',
                borderRadius: 10,
                border: 'none',
                background: nameInput.trim() && password.trim() ? '#2563eb' : '#e5e7eb',
                color: nameInput.trim() && password.trim() ? '#fff' : '#999',
                fontSize: 15,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: nameInput.trim() && password.trim() ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
              }}
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    )
  }

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
        borderBottom: '1px solid #eee',
        flexShrink: 0,
        background: 'linear-gradient(to bottom, rgba(239, 246, 255, 0.6), transparent)',
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
        {messages.length > 0 && (
          <button onClick={clearChat} className="clear-chat-btn">
            Clear chat
          </button>
        )}
      </header>

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 0',
        background: 'linear-gradient(180deg, rgba(248, 250, 252, 0.5) 0%, rgba(255,255,255,0) 120px)',
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
                {getGreeting()}
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
                  className="suggestion-chip"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => setModal('prompt')} className="info-btn">
                <InfoIcon /> View System Prompt
              </button>
              <button onClick={() => setModal('contribution')} className="info-btn">
                <DocIcon /> View AI Contribution Log
              </button>
              <button onClick={() => setModal('safety')} className="info-btn">
                <ShieldIcon /> View Safety Policy
              </button>
              <button onClick={() => setModal('features')} className="info-btn">
                <SparkleIcon /> View Features
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((message, index) => {
              // Hide empty assistant placeholder — typing dots cover this state
              if (message.role === 'assistant' && !message.content && isLoading) return null
              const isStreamingMsg = isLoading && message.role === 'assistant' && index === messages.length - 1 && !!message.content
              return (
              <div
                key={index}
                className="message-fade-in"
                style={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: 10,
                  alignItems: 'flex-start',
                  minWidth: 0,
                }}
              >
                {message.role === 'assistant' && <BotIcon />}
                <div
                  className={message.role === 'assistant' ? `assistant-message${isStreamingMsg ? ' streaming' : ''}` : undefined}
                  style={{
                    maxWidth: '78%',
                    minWidth: 0,
                    padding: message.role === 'user' ? '10px 16px' : '2px 0',
                    borderRadius: message.role === 'user' ? 18 : 0,
                    background: message.role === 'user' ? '#2563eb' : 'transparent',
                    color: message.role === 'user' ? '#fff' : '#333',
                    fontSize: 15,
                    lineHeight: 1.6,
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm]}>{message.content}</ReactMarkdown>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
              )
            })}
            {isLoading && !(messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content) && (
              <div className="typing-indicator" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
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
              {attachment.mimeType === 'application/pdf' ? (
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  border: '1px solid #e0e0e0',
                  background: '#f8f8fa',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}>
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span style={{ fontSize: 8, color: '#999', maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    {attachment.fileName || 'PDF'}
                  </span>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
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
              )}
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
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,application/pdf"
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
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="paperclip-btn"
            style={{
              color: attachment ? '#2563eb' : '#bbb',
            }}
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
              fontSize: 15,
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none',
              lineHeight: 1.5,
            }}
          />
          {/* Model picker */}
          <div ref={modelPickerRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setModelPickerOpen(prev => !prev)}
              disabled={isLoading}
              className="model-picker-btn"
            >
              {MODELS.find(m => m.id === selectedModel)?.label ?? 'Model'}
              <ChevronIcon />
            </button>
            {modelPickerOpen && (
              <div className="model-picker-dropdown" style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: 6,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                zIndex: 40,
                minWidth: 160,
              }}>
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedModel(m.id)
                      setModelPickerOpen(false)
                    }}
                    className="model-option"
                    style={{
                      background: m.id === selectedModel ? '#f0f5ff' : 'transparent',
                      color: m.id === selectedModel ? '#2563eb' : '#333',
                      fontWeight: m.id === selectedModel ? 600 : 400,
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={!canSend}
            className="send-btn"
          >
            <SendIcon />
          </button>
        </form>
        <p style={{
          textAlign: 'center',
          fontSize: 11.5,
          color: '#bbb',
          marginTop: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}>
          <span>Powered by {MODELS.find(m => m.id === selectedModel)?.label ?? 'AI'} · Where&apos;s the Error Handling?!</span>
          <span className="filter-badge">
            <ShieldIcon /> Content filters active
          </span>
        </p>
      </div>

      {/* Modals */}
      {modal === 'prompt' && (
        <Modal title="System Prompt" onClose={() => setModal(null)}>
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
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
      {modal === 'safety' && (
        <Modal title="Safety Policy" onClose={() => setModal(null)}>
          <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm]}>{SAFETY_POLICY_MD}</ReactMarkdown>
        </Modal>
      )}
      {modal === 'features' && (
        <Modal title="Features" onClose={() => setModal(null)}>
          <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm]}>{FEATURES_MD}</ReactMarkdown>
        </Modal>
      )}
    </div>
  )
}
