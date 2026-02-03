'use client';

import Image from 'next/image';
import { useState, useRef } from 'react';
import { 
  FaDiscord, 
  FaTwitter, 
  FaTrophy, 
  FaUsers, 
  FaChartLine, 
  FaBars, 
  FaTimes 
} from 'react-icons/fa'; 

export default function LandingPage() {
  const [copied, setCopied] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Estado para o menu mobile
  const emailRef = useRef<HTMLInputElement>(null);

  const handleCopyEmail = () => {
    if (emailRef.current) {
      emailRef.current.select();
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Função para fechar o menu ao clicar em um link
  const closeMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-blue-950 text-white font-sans antialiased overflow-x-hidden">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-gray-950/90 backdrop-blur-md shadow-lg border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          
          {/* Logo / Brand (Opcional - adicionei um texto placeholder se não tiver logo) */}
          <div className="text-xl font-bold text-yellow-500 tracking-wider">
            ALFA RACING
          </div>

          {/* Menu Desktop */}
          <div className="hidden md:flex space-x-8 items-center">
            <a href="/login" className="text-white hover:text-yellow-400 font-medium transition-colors duration-300">Login @</a>
            <a href="#sobre" className="text-gray-300 hover:text-yellow-400 transition-colors duration-300">Sobre</a>
            <a href="#conquistas" className="text-gray-300 hover:text-yellow-400 transition-colors duration-300">Conquistas</a>
            <a href="#junte-se" className="text-gray-300 hover:text-yellow-400 transition-colors duration-300">Junte-se</a>
            <a href="#contato" className="text-gray-300 hover:text-yellow-400 transition-colors duration-300">Contato</a>
          </div>

          {/* Botão Menu Mobile */}
          <button 
            onClick={toggleMobileMenu} 
            className="md:hidden text-2xl text-white focus:outline-none hover:text-yellow-500 transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        {/* Menu Mobile Dropdown */}
        <div className={`md:hidden absolute w-full bg-gray-950/95 backdrop-blur-xl border-b border-gray-800 shadow-2xl transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10 pointer-events-none'}`}>
          <div className="flex flex-col items-center py-6 space-y-6 text-lg">
            <a href="/login" onClick={closeMenu} className="text-yellow-400 font-semibold tracking-wide">Login @</a>
            <a href="#sobre" onClick={closeMenu} className="hover:text-yellow-400 transition-colors">Sobre</a>
            <a href="#conquistas" onClick={closeMenu} className="hover:text-yellow-400 transition-colors">Conquistas</a>
            <a href="#junte-se" onClick={closeMenu} className="hover:text-yellow-400 transition-colors">Junte-se</a>
            <a href="#contato" onClick={closeMenu} className="hover:text-yellow-400 transition-colors">Contato</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative min-h-screen flex items-center justify-center text-center overflow-hidden bg-cover bg-center bg-no-repeat bg-fixed" style={{ backgroundImage: "url('/images/hero-bg.jpg')" }}>
        {/* Overlay Escuro */}
        <div className="absolute inset-0 bg-black/60 md:bg-black/70 flex flex-col items-center justify-center p-6 pt-20">          
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white leading-tight animate-fade-in-up drop-shadow-lg">
            ALFA RACING <br className="md:hidden"/> <span className="text-yellow-500">BRASIL</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg md:text-xl max-w-2xl text-gray-200 animate-fade-in-up delay-200 font-medium px-4">
            A paixão pela velocidade e a estratégia do GPRO se encontram aqui.
            Domine as pistas conosco!
          </p>
          <a
            href="#junte-se"
            className="mt-10 px-8 py-4 bg-yellow-500 text-gray-900 text-lg font-bold rounded-full shadow-yellow-500/20 shadow-lg hover:bg-yellow-400 transition-all duration-300 transform hover:scale-105 active:scale-95 animate-bounce-in delay-500"
          >
            Seja um Lobo Alfa!
          </a>
        </div>
      </section>

      {/* Sobre Nós */}
      <section id="sobre" className="py-16 px-6 md:px-12 bg-gradient-to-b from-gray-900 to-blue-900">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-yellow-500 mb-6 animate-fade-in-left">Sobre a Alfa Racing Brasil</h2>
          <p className="text-base md:text-lg text-gray-300 mb-12 animate-fade-in-left delay-100 max-w-3xl mx-auto leading-relaxed">
            Nascemos da paixão por automobilismo e pelo desafio estratégico do Grand Prix Racing Online (GPRO).
            Nossa equipe é formada por gerentes dedicados, apaixonados por táticas, desenvolvimento de pilotos e carros.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="p-8 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl shadow-xl hover:shadow-2xl hover:border-yellow-500/30 transition-all duration-300 animate-fade-in-up">
              <FaUsers className="text-5xl text-yellow-500 mx-auto mb-6" />
              <h3 className="text-xl font-semibold mb-3 text-white">Comunidade Ativa</h3>
              <p className="text-gray-400 text-sm md:text-base">Troque ideias, estratégias e experiências com outros entusiastas do GPRO.</p>
            </div>
            
            <div className="p-8 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl shadow-xl hover:shadow-2xl hover:border-yellow-500/30 transition-all duration-300 animate-fade-in-up delay-100">
              <FaChartLine className="text-5xl text-yellow-500 mx-auto mb-6" />
              <h3 className="text-xl font-semibold mb-3 text-white">Foco em Estratégia</h3>
              <p className="text-gray-400 text-sm md:text-base">Aprimore suas habilidades de gerenciamento e tática para dominar as pistas.</p>
            </div>
            
            <div className="p-8 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl shadow-xl hover:shadow-2xl hover:border-yellow-500/30 transition-all duration-300 animate-fade-in-up delay-200">
               {/* Fallback caso a imagem não exista, use um container ou ícone */}
               <div className="mx-auto mb-6 relative w-24 h-24 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
                  <Image
                    src="/images/bandeira-brasil.png"
                    alt="Bandeira do Brasil"
                    width={80}
                    height={80}
                    className="object-cover w-full h-full"
                    // Adicione um placeholder se quiser evitar layout shift
                  />
               </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Orgulho Brasileiro</h3>
              <p className="text-gray-400 text-sm md:text-base">Representamos o Brasil com garra e talento no cenário global do GPRO.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Conquistas Recentes */}
      <section id="conquistas" className="py-16 px-6 md:px-12 bg-gray-950">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-yellow-500 mb-10 animate-fade-in-right">Nossas Conquistas</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Card 1 */}
            <div className="bg-gray-900 border border-gray-800 p-8 rounded-xl shadow-lg flex flex-col items-center text-center animate-fade-in-right">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-6">
                <FaTrophy className="text-4xl text-yellow-500" />
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-white">Títulos de Liga</h3>
              <p className="text-gray-400 mb-6 text-sm md:text-base">
                Celebramos diversos títulos em ligas de diferentes níveis, mostrando nossa consistência.
              </p>
              <ul className="text-left w-full text-gray-400 text-sm space-y-3 bg-gray-800/50 p-4 rounded-lg">
                <li><span className="font-bold text-yellow-500">🏆 Liga Elite:</span> Quem será o primeiro? ()</li>
                <li><span className="font-bold text-yellow-500">🥇 Liga Pro:</span> Campeões ()</li>
                <li><span className="font-bold text-yellow-500">🌟 Liga Amador:</span> Múltiplas vitórias</li>
              </ul>
            </div>

            {/* Card 2 */}
            <div className="bg-gray-900 border border-gray-800 p-8 rounded-xl shadow-lg flex flex-col items-center text-center animate-fade-in-right delay-100">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-6">
                <FaChartLine className="text-4xl text-yellow-500" />
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-white">Recordes e Evolução</h3>
              <p className="text-gray-400 mb-6 text-sm md:text-base">
                Constantemente quebramos nossos próprios recordes e ajudamos nossos membros.
              </p>
              <ul className="text-left w-full text-gray-400 text-sm space-y-3 bg-gray-800/50 p-4 rounded-lg">
                <li><span className="font-bold text-yellow-500">📈 Recorde:</span> 461.2001 pts na temporada 82</li>
                <li><span className="font-bold text-yellow-500">🚀 Promoções:</span> +50 subidas de liga</li>
                <li><span className="font-bold text-yellow-500">⚙️ Setup:</span> 90% eficiência média</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Junte-se à Equipe */}
      <section id="junte-se" className="py-20 px-6 md:px-12 bg-gradient-to-r from-blue-900 to-gray-900 text-center relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-full bg-pattern opacity-10 pointer-events-none"></div>

        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-fade-in-up">Quer Fazer Parte?</h2>
          <p className="text-base md:text-lg text-gray-300 mb-10 animate-fade-in-up delay-100 max-w-2xl mx-auto">
            Buscamos gerentes dedicados, com espírito de equipe e vontade de aprender.
            Se você compartilha essa paixão, nós temos um lugar para você!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 text-left">
            <div className="bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl border border-gray-700 shadow-xl animate-fade-in-left">
              <h3 className="text-xl font-bold text-yellow-500 mb-4">O Que Oferecemos:</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 text-sm md:text-base">
                <li>Apoio de gerentes experientes.</li>
                <li>Ambiente colaborativo.</li>
                <li>Oportunidades de crescimento.</li>
                <li>Campeonatos internos.</li>
              </ul>
            </div>
            <div className="bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl border border-gray-700 shadow-xl animate-fade-in-right">
              <h3 className="text-xl font-bold text-yellow-500 mb-4">Como se Candidatar:</h3>
              <p className="text-gray-300 mb-4 text-sm md:text-base">
                É simples! Entre em contato via Discord ou e-mail. Conte-nos sua experiência no GPRO.
              </p>
              <p className="text-white font-semibold text-sm md:text-base">Estamos ansiosos para te conhecer!</p>
            </div>
          </div>

          <a
            href="https://discord.gg/SEULINKDISCORD" 
            target="_blank"
            rel="noopener noreferrer"
            className="mt-12 inline-flex items-center px-8 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white text-lg font-bold rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 animate-bounce-in w-full md:w-auto justify-center"
          >
            <FaDiscord className="mr-3 text-2xl" />
            Entrar no Discord
          </a>
        </div>
      </section>

      {/* Contato */}
      <section id="contato" className="py-16 px-6 md:px-12 bg-gray-950 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-yellow-500 mb-6 animate-fade-in-down">Fale Conosco</h2>
          <p className="text-base md:text-lg text-gray-300 mb-10 animate-fade-in-down delay-100">
            Dúvidas ou sugestões? Entre em contato!
          </p>

          <div className="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-6">
            <div className="relative w-full md:w-auto group">
              <input
                ref={emailRef}
                type="text"
                value="contato@alfaracingbrasil.com" 
                readOnly
                className="w-full md:w-80 p-4 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 text-sm md:text-base focus:outline-none focus:border-yellow-500 transition-colors pr-20 truncate"
              />
              <button
                onClick={handleCopyEmail}
                className={`absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-300 ${
                    copied 
                    ? 'bg-green-600 text-white' 
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>

            <a
              href="https://twitter.com/alfaracingbr"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full md:w-auto inline-flex justify-center items-center px-8 py-3.5 bg-black text-white border border-gray-800 rounded-full shadow-lg hover:bg-gray-900 hover:border-blue-400 transition-all duration-300"
            >
              <FaTwitter className="mr-3 text-xl text-blue-400" />
              Twitter/X
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 border-t border-gray-900 py-8 px-6 text-center text-gray-500 text-xs md:text-sm">
        <div className="max-w-4xl mx-auto">
          <p className="font-medium text-gray-400">&copy; {new Date().getFullYear()} Alfa Racing Brasil.</p>
          <p className="mt-1">Feito com paixão por GPRO.</p>
          <div className="flex flex-col md:flex-row justify-center items-center gap-3 md:gap-6 mt-6">
            <a href="https://gpro.net/gb/gpro.asp" target="_blank" rel="noopener noreferrer" className="hover:text-yellow-500 transition-colors">GPRO Official</a>
            <span className="hidden md:inline text-gray-700">|</span>
            <a href="#" className="hover:text-yellow-500 transition-colors">Política de Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
}