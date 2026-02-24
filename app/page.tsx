'use client'

import { useState, useRef, useEffect, useCallback, FormEvent, KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Review my Python code',
  'Roast my portfolio site',
  'Is my code spaghetti?',
  'Am I using Git wrong?',
]

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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: content.trim() }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
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
  }, [messages, isLoading])

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
  }

  const canSend = input.trim() && !isLoading

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
        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: 14,
          padding: '4px 4px 4px 16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
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
          Powered by Claude · Where&apos;s the Error Handling?!
        </p>
      </div>
    </div>
  )
}
