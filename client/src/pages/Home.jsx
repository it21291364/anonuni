import Header from '../components/Header.jsx'
import MatchForm from '../components/MatchForm.jsx'

export default function Home({ onStart }){
  return (
    <div className="container">
      <Header />
      <div className="card" style={{marginTop:16}}>
        <h2 style={{marginTop:0}}>Find a chat partner</h2>
        <MatchForm onStart={onStart} />
      </div>
      <div className="small" style={{marginTop:12}}>
        Tip: Use common interests like “cricket, anime, startup, exams” for faster matching.
      </div>
    </div>
  )
}