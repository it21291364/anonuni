import React from 'react'
import Header from '../components/Header.jsx'
import MessageBubble from '../components/MessageBubble.jsx'

export default function Chat({ socket, session, onLeaveHard, onRequeue, setQueued, setSession }){
  const [messages, setMessages] = React.useState([])
  const [text, setText] = React.useState("")
  const [typing, setTyping] = React.useState(false)
  const [common, setCommon] = React.useState(session?.commonInterests || [])
  const promptedRef = React.useRef(false) // prevent double-prompt

  React.useEffect(()=>{
    if (!socket) return

    const onMessage = (m)=> setMessages(prev=> [...prev, m])
    const onTyping = ({ from, state }) => { if (from !== socket.id) setTyping(!!state) }

    const onMatch = (data) => {
      promptedRef.current = false
      if (data?.commonInterests) setCommon(data.commonInterests)
      setMessages([])
      setTyping(false)
      setSession(data)
    }

    const onEnded = ({ reason, canRequeue } = {}) => {
      if (promptedRef.current) return
      promptedRef.current = true

      setTyping(false)
      const ask = window.confirm('Partner left. Do you want to connect to a new chat partner with the same interests?')
      if (ask && canRequeue) {
        setQueued(true)
        onRequeue()   // emit 'requeue'
      } else {
        onLeaveHard() // back to home
      }
    }

    socket.on('message', onMessage)
    socket.on('typing', onTyping)
    socket.on('match_found', onMatch)
    socket.on('session_ended', onEnded)

    // IMPORTANT: do NOT listen to 'partner_left' anymore (server no longer emits it).
    return ()=>{
      socket.off('message', onMessage)
      socket.off('typing', onTyping)
      socket.off('match_found', onMatch)
      socket.off('session_ended', onEnded)
    }
  }, [socket, onLeaveHard, onRequeue, setQueued, setSession])

  const send = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    socket.emit('send_message', { roomId: session.roomId, text })
    setText("")
  }

  const onTypingChange = (e) => {
    const value = e.target.value
    setText(value)
    socket.emit('typing', { roomId: session.roomId, state: true })
    if (Chat._typingTimer) clearTimeout(Chat._typingTimer)
    Chat._typingTimer = setTimeout(()=> socket.emit('typing', { roomId: session.roomId, state: false }), 900)
  }

  const confirmAnd = (fn) => {
    if (window.confirm('Are you sure you want to leave this chat?')) fn()
  }

  const leaveAll = () => {
    if (socket) socket.emit('leave') // triggers 'session_ended' on both
  }

  return (
    <div className="container">
      <Header />
      <div className="card" style={{marginTop:16}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div className="small">Connected to: <strong>{session?.partner?.university || 'Unknown'}</strong></div>
            <div className="small">You: {session?.you?.university}</div>
            {common?.length > 0 && (
              <div className="chips"><span className="small" style={{opacity:.8}}>Common:</span>
                {common.map((c,i)=> <span className="chip" key={i}>{c}</span>)}
              </div>
            )}
          </div>
          <div style={{display:'flex', gap:8}}>
            <button className="btn" onClick={()=> confirmAnd(()=> socket.emit('skip'))}>Skip</button>
            <button className="btn" onClick={()=> confirmAnd(leaveAll)}>Leave</button>
          </div>
        </div>

        <div className="chat" style={{marginTop:12}}>
          <div className="messages">
            {messages.map((m, i)=> (
              <MessageBubble key={i} me={m.from === socket.id} text={m.text} />
            ))}
          </div>
          {typing && (
            <div className="typing" aria-live="polite" aria-label="Partner is typing">
              <span className="small" style={{marginRight:6}}>Partner is typing</span>
              <span className="dot"/><span className="dot"/><span className="dot"/>
            </div>
          )}
          <form className="footer" onSubmit={send}>
            <input className="input" placeholder="Type a message…" value={text} onChange={onTypingChange} />
            <button className="btn">Send</button>
          </form>
        </div>
      </div>
    </div>
  )
}
