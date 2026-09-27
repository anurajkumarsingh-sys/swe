'use client'

import { useState } from 'react'
import type { QuizData } from '@/lib/content-engine'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface QuizOverlayProps {
  quiz: QuizData
  onComplete: (correct: number, total: number) => void
}

export function QuizOverlay({ quiz, onComplete }: QuizOverlayProps) {
  const [currentQ, setCurrentQ] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const totalQuestions = quiz?.questions?.length || 0
  
  if (totalQuestions === 0) {
    return (
      <div className="overlay-backdrop absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-[var(--surface-1)] border border-[var(--neon-red)]/30 rounded-2xl p-6 shadow-[0_0_50px_-12px_rgba(239,68,68,0.3)] text-center">
          <XCircle className="w-12 h-12 text-[var(--neon-red)] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[var(--foreground)] mb-2">Quiz Generation Failed</h3>
          <p className="text-sm text-[var(--muted-foreground)] mb-6">We couldn't generate a quiz based on the current context.</p>
          <button
            onClick={() => onComplete(0, 0)}
            className="px-6 py-3 rounded-xl bg-[var(--surface-2)] text-[var(--foreground)] font-bold text-sm hover:bg-[var(--surface-3)] transition-all"
          >
            Skip & Resume Video
          </button>
        </div>
      </div>
    )
  }

  const question = quiz.questions[currentQ]

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null) return
    setSelectedAnswer(index)
    const correct = index === question.correct
    setIsCorrect(correct)
    setShowExplanation(true)
    if (correct) {
      setCorrectCount((c: number) => c + 1)
    }
  }

  const handleNext = () => {
    if (currentQ + 1 < totalQuestions) {
      setCurrentQ((q: number) => q + 1)
      setSelectedAnswer(null)
      setIsCorrect(null)
      setShowExplanation(false)
    } else {
      onComplete(correctCount + (isCorrect ? 1 : 0), totalQuestions)
    }
  }

  const handleRetry = () => {
    setSelectedAnswer(null)
    setIsCorrect(null)
    setShowExplanation(false)
  }

  return (
    <div className="overlay-backdrop absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[var(--surface-1)] border border-[var(--neon-red)]/30 rounded-2xl p-6 shadow-[0_0_50px_-12px_rgba(239,68,68,0.3)] relative overflow-hidden">
        {/* Animated glow background element */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[var(--neon-red)]/10 blur-[80px] rounded-full" />
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-[var(--neon-red)]/20 flex items-center justify-center shrink-0 border border-[var(--neon-red)]/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <AlertTriangle className="w-6 h-6 text-[var(--neon-red)] animate-pulse" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
              Wake Up Call!
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] font-medium">
              You're drifting off. Answer these correctly to continue.
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative z-10 mb-6">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--muted-foreground)]">
              Question {currentQ + 1} of {totalQuestions}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--neon-green)]">
              Score: {correctCount}/{currentQ}
            </span>
          </div>
          <div className="h-1.5 w-full bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[var(--neon-green)] transition-all duration-500 ease-out shadow-[0_0_10px_rgba(34,197,94,0.5)]"
              style={{ width: `${((currentQ + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="relative z-10 mb-6">
          <h4 className="text-base font-semibold text-[var(--foreground)] leading-snug">
            {question.question}
          </h4>
        </div>

        {/* Options */}
        <div className="relative z-10 flex flex-col gap-2.5 mb-6">
          {question.options.map((option, index) => {
            let optionStyle = 'border-[var(--border)] hover:border-[var(--neon-blue)]/50 hover:bg-[var(--surface-2)] hover:translate-x-1'
            let icon = null

            if (selectedAnswer !== null) {
              if (index === question.correct) {
                optionStyle = 'border-[var(--neon-green)] bg-[var(--neon-green)]/10 translate-x-1'
                icon = <CheckCircle className="w-4 h-4 text-[var(--neon-green)]" />
              } else if (index === selectedAnswer && !isCorrect) {
                optionStyle = 'border-[var(--neon-red)] bg-[var(--neon-red)]/10 translate-x-1'
                icon = <XCircle className="w-4 h-4 text-[var(--neon-red)]" />
              } else {
                optionStyle = 'border-[var(--border)] opacity-40 grayscale-[0.5]'
              }
            }

            return (
              <button
                key={index}
                onClick={() => handleAnswer(index)}
                disabled={selectedAnswer !== null}
                className={`w-full flex items-center justify-between px-5 py-4 rounded-xl border text-sm transition-all duration-300 font-medium ${optionStyle} ${
                  selectedAnswer !== null ? 'cursor-default' : 'cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border ${
                    selectedAnswer === index ? 'bg-current border-transparent text-white' : 'border-[var(--border)] text-[var(--muted-foreground)]'
                  }`}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="text-[var(--foreground)] text-left">{option}</span>
                </div>
                {icon}
              </button>
            )
          })}
        </div>

        {/* Explanation + Next/Retry */}
        {showExplanation && (
          <div className={`relative z-10 p-5 rounded-xl border animate-in slide-in-from-bottom-2 duration-300 ${
            isCorrect ? 'bg-[var(--neon-green)]/5 border-[var(--neon-green)]/20' : 'bg-[var(--neon-red)]/5 border-[var(--neon-red)]/20'
          }`}>
            <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isCorrect ? 'text-[var(--neon-green)]' : 'text-[var(--neon-red)]'}`}>
              {isCorrect ? 'Excellent!' : 'Not quite right'}
            </p>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mb-4">
              {question.explanation}
            </p>
            
            {isCorrect ? (
              <button
                onClick={handleNext}
                className="w-full py-3 rounded-xl bg-[var(--neon-green)] text-[var(--surface-0)] font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_4px_15px_rgba(34,197,94,0.3)]"
              >
                {currentQ + 1 < totalQuestions ? 'Next Challenge' : 'Resume Lecture'}
              </button>
            ) : (
              <button
                onClick={handleRetry}
                className="w-full py-3 rounded-xl bg-[var(--surface-2)] text-[var(--foreground)] border border-[var(--border)] font-bold text-sm hover:bg-[var(--surface-3)] transition-all"
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
