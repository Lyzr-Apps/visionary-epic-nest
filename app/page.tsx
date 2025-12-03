'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Send, X, Minus, ThumbsUp, ThumbsDown, Loader2, HelpCircle, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

const SUPPORT_AGENT_CONFIG = {
  id: '693050ee2bb6b2ddb363e3cb',
  name: 'Support',
  title: 'Amadeo Support',
  subtitle: 'Customer Support',
  icon: HelpCircle,
  welcomeMessage: 'Hi there! I\'m Amadeo Support Assistant. I\'m here to answer any questions about Amadeo Banking AI Agent. You can ask me about features, capabilities, integrations, pricing, or use cases. What would you like to know?',
  suggestions: [
    'What is Amadeo?',
    'What are the key features?',
    'How does integration work?',
    'What use cases are supported?'
  ]
}

const SALES_AGENT_CONFIG = {
  id: '693053006faee4d469e8a424',
  name: 'Sales',
  title: 'Amadeo Sales Copilot',
  subtitle: 'Sales Development',
  icon: TrendingUp,
  welcomeMessage: 'Welcome! I\'m your Amadeo Sales Copilot. I\'m here to help you close more deals by providing sales strategies, objection handling, competitive positioning, and pitch preparation. How can I assist with your sales efforts today?',
  suggestions: [
    'How do I pitch Amadeo to a prospect?',
    'How do I handle common objections?',
    'What\'s Amadeo\'s competitive advantage?',
    'Can you help me prepare a sales deck?'
  ]
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeAgent, setActiveAgent] = useState<'support' | 'sales'>('support')
  const [supportMessages, setSupportMessages] = useState<Message[]>([])
  const [salesMessages, setSalesMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(SUPPORT_AGENT_CONFIG.suggestions)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  // Get current messages and config based on active agent
  const currentConfig = activeAgent === 'support' ? SUPPORT_AGENT_CONFIG : SALES_AGENT_CONFIG
  const messages = activeAgent === 'support' ? supportMessages : salesMessages
  const setMessages = activeAgent === 'support' ? setSupportMessages : setSalesMessages

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize with welcome message when opening or switching agents
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: '1',
          text: currentConfig.welcomeMessage,
          sender: 'agent',
          timestamp: new Date()
        }
      ])
      setSuggestedQuestions(currentConfig.suggestions)
    }
  }, [isOpen, activeAgent])

  // Handle agent switching
  const handleAgentSwitch = (agent: 'support' | 'sales') => {
    setActiveAgent(agent)
    const targetMessages = agent === 'support' ? supportMessages : salesMessages
    const config = agent === 'support' ? SUPPORT_AGENT_CONFIG : SALES_AGENT_CONFIG

    // Initialize welcome message if no messages in target agent
    if (targetMessages.length === 0) {
      setMessages([
        {
          id: '1',
          text: config.welcomeMessage,
          sender: 'agent',
          timestamp: new Date()
        }
      ])
    }
    setSuggestedQuestions(config.suggestions)
  }

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
      // Call the appropriate agent API based on active agent
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          agent_id: currentConfig.id
        })
      })

      const data = await response.json()

      // Add agent response with robust parsing for different agent formats
      if (data.success) {
        let responseText = ''
        let followups: string[] = []

        // Handle different response formats
        if (typeof data.response === 'string') {
          responseText = data.response
        } else if (data.response && typeof data.response === 'object') {
          // Support Agent format: data.response.response
          responseText = data.response.response

          // Sales Agent format: data.response.sales_guidance.main_response
          if (!responseText && data.response.sales_guidance?.main_response) {
            responseText = data.response.sales_guidance.main_response
          }

          // Fallback: data.response.message or data.response.text
          if (!responseText) {
            responseText = data.response.message
              ?? data.response.text
              ?? (typeof data.response === 'string' ? data.response : '')
          }

          // Extract suggested follow-ups - Support Agent format
          if (data.response.suggested_followups && Array.isArray(data.response.suggested_followups)) {
            followups = data.response.suggested_followups.filter((q: string) => q && q.trim().length > 0)
          }

          // Extract suggested follow-ups - Sales Agent format
          if (!followups.length && data.response.sales_guidance?.suggested_questions && Array.isArray(data.response.sales_guidance.suggested_questions)) {
            followups = data.response.sales_guidance.suggested_questions.filter((q: string) => q && q.trim().length > 0)
          }
        }

        // Fallback if we couldn't extract text
        if (!responseText || responseText.trim().length === 0) {
          responseText = "I understood your question. Please feel free to ask follow-up questions if you need more information."
        }

        const agentMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: responseText.trim(),
          sender: 'agent',
          timestamp: new Date(),
          feedback: null
        }

        setMessages(prev => [...prev, agentMessage])

        // Set suggested follow-ups if available
        if (followups.length > 0) {
          setSuggestedQuestions(followups)
        }
      } else {
        // Handle error response
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: "I'm having trouble processing your question. Please try again.",
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
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              {currentConfig.icon && <currentConfig.icon size={20} />}
            </div>
            <div>
              <h2 className="font-semibold text-white">{currentConfig.title}</h2>
              <p className="text-xs text-blue-100">{currentConfig.subtitle}</p>
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
                setSupportMessages([])
                setSalesMessages([])
              }}
              className="hover:bg-blue-500 p-1.5 rounded transition"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Agent Tabs */}
        <Tabs value={activeAgent} onValueChange={(value) => handleAgentSwitch(value as 'support' | 'sales')} className="w-full">
          <TabsList className="w-full bg-blue-500 bg-opacity-40 border-0">
            <TabsTrigger value="support" className="flex-1 text-xs data-[state=active]:bg-blue-400 data-[state=active]:text-white text-blue-100">
              Support
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex-1 text-xs data-[state=active]:bg-blue-400 data-[state=active]:text-white text-blue-100">
              Sales Copilot
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
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
      </div>

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
