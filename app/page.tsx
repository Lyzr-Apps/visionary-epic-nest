'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Send, X, Minus, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Message {
  id: string
  text: string
  sender: 'user' | 'agent'
  timestamp: Date
  feedback?: 'up' | 'down' | null
}

interface AgentResponse {
  response: string
  status: string
  confidence: number
  suggested_followups?: string[]
  metadata?: {
    topic: string
    sources_used: string[]
    timestamp: string
  }
}

const QUICK_REPLY_SUGGESTIONS = [
  'What is Amadeo?',
  'What are the key features?',
  'How does integration work?',
  'What use cases are supported?'
]

const SAMPLE_WELCOME_MESSAGE = 'Hi there! I\'m Amadeo Support Assistant. I\'m here to answer any questions about Amadeo Banking AI Agent. You can ask me about features, capabilities, integrations, pricing, or use cases. What would you like to know?'

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(QUICK_REPLY_SUGGESTIONS)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: '1',
          text: SAMPLE_WELCOME_MESSAGE,
          sender: 'agent',
          timestamp: new Date()
        }
      ])
    }
  }, [isOpen])

  // Reset unread count when opening
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0)
    }
  }, [isOpen])

  const handleSendMessage = async (messageText: string = inputValue) => {
    if (!messageText.trim()) return

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setSuggestedQuestions([])

    try {
      // Call the Amadeo Support Agent API
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          agent_id: '693050ee2bb6b2ddb363e3cb'
        })
      })

      const data = await response.json()

      // Add agent response
      if (data.success && data.response) {
        const agentResponse: AgentResponse = data.response

        const agentMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: typeof agentResponse === 'string'
            ? agentResponse
            : agentResponse.response || JSON.stringify(agentResponse),
          sender: 'agent',
          timestamp: new Date(),
          feedback: null
        }

        setMessages(prev => [...prev, agentMessage])

        // Set suggested follow-ups if available
        if (agentResponse.suggested_followups && Array.isArray(agentResponse.suggested_followups)) {
          setSuggestedQuestions(agentResponse.suggested_followups)
        }
      } else {
        // Handle error response
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response?.response || "I'm having trouble processing your question. Please try again.",
          sender: 'agent',
          timestamp: new Date(),
          feedback: null
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Error calling agent:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting. Please try again later.",
        sender: 'agent',
        timestamp: new Date(),
        feedback: null
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleFeedback = (messageId: string, feedback: 'up' | 'down') => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, feedback: msg.feedback === feedback ? null : feedback }
          : msg
      )
    )
  }

  const handleQuickReply = (question: string) => {
    handleSendMessage(question)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Floating launcher button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all duration-300 hover:shadow-xl"
        aria-label="Open chat"
      >
        <div className="relative">
          <MessageCircle size={24} />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </button>
    )
  }

  // Chat panel
  return (
    <div className="fixed bottom-6 right-6 z-40 w-96 max-h-[600px] flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <MessageCircle size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-white">Amadeo Support</h2>
            <p className="text-xs text-blue-100">Always here to help</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpen(false)}
            className="hover:bg-blue-500 p-1.5 rounded transition"
            aria-label="Minimize chat"
          >
            <Minus size={18} />
          </button>
          <button
            onClick={() => {
              setIsOpen(false)
              setMessages([])
            }}
            className="hover:bg-blue-500 p-1.5 rounded transition"
            aria-label="Close chat"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4 bg-gray-50">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-200 text-gray-900 rounded-bl-none'
                }`}
              >
                <p className="text-sm leading-relaxed break-words">{message.text}</p>
                <p
                  className={`text-xs mt-1.5 ${
                    message.sender === 'user'
                      ? 'text-blue-100'
                      : 'text-gray-500'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>

                {/* Feedback buttons for agent messages */}
                {message.sender === 'agent' && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-300">
                    <button
                      onClick={() => handleFeedback(message.id, 'up')}
                      className={`p-1 transition ${
                        message.feedback === 'up'
                          ? 'text-green-600 bg-green-50 rounded'
                          : 'text-gray-500 hover:text-green-600'
                      }`}
                      aria-label="Helpful"
                    >
                      <ThumbsUp size={14} />
                    </button>
                    <button
                      onClick={() => handleFeedback(message.id, 'down')}
                      className={`p-1 transition ${
                        message.feedback === 'down'
                          ? 'text-red-600 bg-red-50 rounded'
                          : 'text-gray-500 hover:text-red-600'
                      }`}
                      aria-label="Not helpful"
                    >
                      <ThumbsDown size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-900 px-4 py-2.5 rounded-lg rounded-bl-none">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}

          {/* Quick reply suggestions */}
          {suggestedQuestions.length > 0 && !isLoading && (
            <div className="flex flex-col gap-2 mt-4">
              <p className="text-xs text-gray-600 font-medium">Suggested questions:</p>
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickReply(question)}
                  className="text-left px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-400 transition"
                >
                  {question}
                </button>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Ask about Amadeo..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1 text-sm"
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputValue.trim()}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
