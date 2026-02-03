import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Send, Bot, User, Loader2, AlertCircle } from 'lucide-react'
import { callAIAgent } from '@/utils/aiAgent'
import type { NormalizedAgentResponse } from '@/utils/aiAgent'

// Agent ID from orchestrator
const AGENT_ID = "69819b9412326156554941e1"

// TypeScript interfaces from ACTUAL test response
interface AgentResult {
  answer: string
  sources: any[]
  confidence: number
  follow_up_questions: string[]
  requires_escalation: boolean
}

interface AgentResponse {
  status: "success" | "error"
  result: AgentResult
  metadata?: {
    agent_name: string
    timestamp: string
  }
}

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
  confidence?: number
  sources?: any[]
  followUpQuestions?: string[]
  requiresEscalation?: boolean
}

// Suggested starter questions
const STARTER_QUESTIONS = [
  "How can I track my order?",
  "What are your business hours?",
  "Tell me about your services",
  "How do I reset my password?"
]

// Chat message component
function ChatMessage({ message }: { message: Message }) {
  const isAgent = message.role === 'agent'

  return (
    <div className={`flex gap-3 ${isAgent ? 'justify-start' : 'justify-end'}`}>
      {isAgent && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-blue-500 text-white">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={`flex flex-col ${isAgent ? 'items-start' : 'items-end'} max-w-[70%]`}>
        <div
          className={`rounded-2xl px-4 py-2 ${
            isAgent
              ? 'bg-white border border-gray-200 text-gray-900'
              : 'bg-blue-500 text-white'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        {/* Metadata for agent messages */}
        {isAgent && (
          <div className="flex flex-col gap-1 mt-2">
            {/* Confidence score */}
            {message.confidence !== undefined && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {Math.round(message.confidence * 100)}% confident
                </Badge>
              </div>
            )}

            {/* Escalation flag */}
            {message.requiresEscalation && (
              <Badge variant="destructive" className="text-xs w-fit">
                <AlertCircle className="h-3 w-3 mr-1" />
                Human support recommended
              </Badge>
            )}

            {/* Follow-up questions */}
            {message.followUpQuestions && message.followUpQuestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {message.followUpQuestions.map((q, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {q}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-xs text-gray-500 mt-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {!isAgent && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-gray-300 text-gray-700">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

// Typing indicator component
function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-blue-500 text-white">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>

      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Add welcome message on mount
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'agent',
      content: "Hello! I'm your customer support assistant. How can I help you today?",
      timestamp: new Date(),
      confidence: 1.0,
      followUpQuestions: STARTER_QUESTIONS,
      requiresEscalation: false
    }
    setMessages([welcomeMessage])
  }, [])

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim()

    if (!textToSend || loading) return

    // Clear input immediately for better UX
    setInput('')
    setError(null)

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])

    // Call agent
    setLoading(true)
    try {
      const result = await callAIAgent(textToSend, AGENT_ID)

      if (result.success && result.response.status === 'success') {
        const response = result.response as AgentResponse

        // Add agent message with all metadata
        const agentMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: response.result.answer,
          timestamp: new Date(),
          confidence: response.result.confidence,
          sources: response.result.sources,
          followUpQuestions: response.result.follow_up_questions,
          requiresEscalation: response.result.requires_escalation
        }
        setMessages(prev => [...prev, agentMessage])
      } else {
        setError(result.response.message || result.error || 'Failed to get response')

        // Add error message
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: "I'm sorry, I encountered an error. Please try again or contact support if the issue persists.",
          timestamp: new Date(),
          requiresEscalation: true
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (err) {
      setError('Network error occurred')

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: "I'm having trouble connecting right now. Please check your internet connection and try again.",
        timestamp: new Date(),
        requiresEscalation: true
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleQuickReply = (question: string) => {
    handleSend(question)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 rounded-full p-2">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Support Chat</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm text-gray-600">Online</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-5xl mx-auto px-6 py-6">
            <div className="flex flex-col gap-6">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

              {/* Typing indicator */}
              {loading && <TypingIndicator />}

              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Error display */}
      {error && (
        <div className="max-w-5xl mx-auto w-full px-6">
          <Card className="bg-red-50 border-red-200 p-3 mb-3">
            <div className="flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </Card>
        </div>
      )}

      {/* Input Footer */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your question..."
                disabled={loading}
                maxLength={500}
                className="w-full resize-none rounded-2xl border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
              <div className="flex justify-between items-center mt-1 px-2">
                <span className="text-xs text-gray-500">
                  {input.length}/500
                </span>
              </div>
            </div>

            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-full h-10 w-10 p-0 shrink-0"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Quick reply chips - show only when not loading and no user messages yet */}
          {messages.length === 1 && !loading && (
            <div className="mt-4">
              <p className="text-xs text-gray-600 mb-2">Suggested questions:</p>
              <div className="flex flex-wrap gap-2">
                {STARTER_QUESTIONS.map((question, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickReply(question)}
                    className="text-sm rounded-full border-gray-300 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700"
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
