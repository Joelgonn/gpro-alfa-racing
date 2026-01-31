'use client';

import Image from 'next/image';
import { useState, useRef } from 'react';
import { FaDiscord, FaTwitter, FaEnvelope, FaTrophy, FaUsers, FaChartLine } from 'react-icons/fa'; // Ícones para elementos visuais

export default function LandingPage() {
  const [copied, setCopied] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const handleCopyEmail = () => {
    if (emailRef.current) {
      emailRef.current.select();
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Resetar mensagem após 2 segundos
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-blue-950 text-white font-sans antialiased">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-gray-950/80 backdrop-blur-sm shadow-lg py-4 px-6 md:px-12 flex justify-between items-center animate-fade-in-down">
        
        {/* Links de navegação */}
        <div className="flex space-x-6">
          {/* AQUI ESTÁ A MUDANÇA: Aponte para /login */}
          <a href="/login" className="hover:text-yellow-400 transition-colors duration-300">Login @</a>
          {/* FIM DA MUDANÇA */}
          <a href="#sobre" className="hover:text-yellow-400 transition-colors duration-300">Sobre</a>
          <a href="#conquistas" className="hover:text-yellow-400 transition-colors duration-300">Conquistas</a>
          <a href="#junte-se" className="hover:text-yellow-400 transition-colors duration-300">Junte-se</a>
          <a href="#contato" className="hover:text-yellow-400 transition-colors duration-300">Contato</a>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative h-screen flex items-center justify-center text-center overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url('/images/hero-bg.jpg')" }}> {/* Crie hero-bg.jpg em public/images */}
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-8">          
                   
          <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight animate-fade-in-up">
            ALFA RACING <span className="text-yellow-500">BRASIL</span>
          </h1>
          <p className="mt-4 text-lg md:text-xl max-w-2xl text-gray-300 animate-fade-in-up delay-200">
            A paixão pela velocidade e a estratégia do GPRO se encontram aqui.
            Domine as pistas conosco!
          </p>
          <a
            href="#junte-se"
            className="mt-8 px-8 py-3 bg-yellow-500 text-gray-900 text-lg font-semibold rounded-full shadow-lg hover:bg-yellow-400 transition-all duration-300 transform hover:scale-105 animate-bounce-in delay-500"
          >
            Faça Parte da Equipe!
          </a>
        </div>
      </section>

      {/* Sobre Nós */}
      <section id="sobre" className="py-20 px-6 md:px-12 bg-gradient-to-r from-gray-900 to-blue-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-yellow-500 mb-6 animate-fade-in-left">Sobre a Alfa Racing Brasil</h2>
          <p className="text-lg text-gray-300 mb-8 animate-fade-in-left delay-100">
            Nascemos da paixão por automobilismo e pelo desafio estratégico do Grand Prix Racing Online (GPRO).
            Nossa equipe é formada por gerentes dedicados, apaixonados por táticas, desenvolvimento de pilotos e carros,
            e que buscam a excelência em cada corrida. Somos mais que um time; somos uma comunidade de pilotos brasileiros!
          </p>
          <div className="grid md:grid-cols-3 gap-8 mt-12">
            <div className="p-6 bg-gray-800 rounded-lg shadow-xl hover:shadow-2xl transition-all duration-300 animate-fade-in-up">
              <FaUsers className="text-5xl text-yellow-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Comunidade Ativa</h3>
              <p className="text-gray-400">Troque ideias, estratégias e experiências com outros entusiastas do GPRO.</p>
            </div>
            <div className="p-6 bg-gray-800 rounded-lg shadow-xl hover:shadow-2xl transition-all duration-300 animate-fade-in-up delay-100">
              <FaChartLine className="text-5xl text-yellow-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Foco em Estratégia</h3>
              <p className="text-gray-400">Aprimore suas habilidades de gerenciamento e tática para dominar as pistas.</p>
            </div>
            <div className="p-6 bg-gray-800 rounded-lg shadow-xl hover:shadow-2xl transition-all duration-300 animate-fade-in-up delay-200">
              <Image
                src="/images/bandeira-brasil.png" // <<-- IMAGEM DA BANDEIRA DO BRASIL (se tiver)
                alt="Bandeira do Brasil"
                width={100}
                height={75}
                className="mx-auto mb-4 rounded-full"
              />
              <h3 className="text-xl font-semibold mb-2">Orgulho Brasileiro</h3>
              <p className="text-gray-400">Representamos o Brasil com garra e talento no cenário global do GPRO.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Conquistas Recentes */}
      <section id="conquistas" className="py-20 px-6 md:px-12 bg-gray-950">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-yellow-500 mb-10 animate-fade-in-right">Nossas Conquistas</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl flex flex-col items-center text-center animate-fade-in-right">
              <FaTrophy className="text-6xl text-yellow-500 mb-4" />
              <h3 className="text-2xl font-semibold mb-3">Títulos de Liga</h3>
              <p className="text-gray-300 text-lg">
                Celebramos diversos títulos em ligas de diferentes níveis, mostrando nossa consistência e habilidade em evoluir.
              </p>
              <ul className="mt-4 text-left w-full text-gray-400 space-y-2">
                <li><span className="font-bold text-yellow-500">🏆 Liga Elite:</span> 2º lugar na temporada SXX</li>
                <li><span className="font-bold text-yellow-500">🥇 Liga Pro:</span> Campeões nas temporadas SYY e SZZ</li>
                <li><span className="font-bold text-yellow-500">🌟 Liga Amador:</span> Inúmeras vitórias e promoções rápidas</li>
              </ul>
            </div>
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl flex flex-col items-center text-center animate-fade-in-right delay-100">
              <FaChartLine className="text-6xl text-yellow-500 mb-4" />
              <h3 className="text-2xl font-semibold mb-3">Recordes e Evolução</h3>
              <p className="text-gray-300 text-lg">
                Constantemente quebramos nossos próprios recordes e ajudamos nossos membros a atingir seus objetivos no jogo.
              </p>
              <ul className="mt-4 text-left w-full text-gray-400 space-y-2">
                <li><span className="font-bold text-yellow-500">📈 Maior Pontuação:</span> 120 pontos em uma temporada</li>
                <li><span className="font-bold text-yellow-500">🚀 Promoções:</span> Mais de 50 promoções para ligas superiores por nossos membros</li>
                <li><span className="font-bold text-yellow-500">⚙️ Carro Otimizado:</span> Média de 90% de eficiência em setups de corrida</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Junte-se à Equipe */}
      <section id="junte-se" className="py-20 px-6 md:px-12 bg-gradient-to-r from-blue-900 to-gray-900 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-6 animate-fade-in-up">Quer Fazer Parte da Alfa Racing Brasil?</h2>
          <p className="text-lg text-gray-300 mb-10 animate-fade-in-up delay-100">
            Buscamos gerentes dedicados, com espírito de equipe e vontade de aprender e crescer no GPRO.
            Se você compartilha essa paixão, nós temos um lugar para você!
          </p>

          <div className="grid md:grid-cols-2 gap-8 text-left">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl animate-fade-in-left">
              <h3 className="text-2xl font-semibold text-yellow-500 mb-4">O Que Oferecemos:</h3>
              <ul className="list-disc list-inside space-y-3 text-gray-300">
                <li>Apoio e orientação de gerentes experientes.</li>
                <li>Ambiente colaborativo para discutir estratégias.</li>
                <li>Oportunidades de crescimento e promoções em ligas.</li>
                <li>Eventos e campeonatos internos (opcional).</li>
                <li>Uma comunidade divertida e acolhedora.</li>
              </ul>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl animate-fade-in-right">
              <h3 className="text-2xl font-semibold text-yellow-500 mb-4">Como se Candidatar:</h3>
              <p className="text-gray-300 mb-4">É simples! Entre em contato conosco através do nosso Discord ou e-mail. Conte-nos um pouco sobre sua experiência no GPRO e seu interesse em fazer parte da Alfa Racing Brasil.</p>
              <p className="text-gray-300 font-bold">Estamos ansiosos para te conhecer!</p>
            </div>
          </div>

          <a
            href="https://discord.gg/SEULINKDISCORD" // <<-- SUBSTITUA PELO LINK REAL DO SEU DISCORD
            target="_blank"
            rel="noopener noreferrer"
            className="mt-12 inline-flex items-center px-10 py-4 bg-purple-600 text-white text-xl font-bold rounded-full shadow-lg hover:bg-purple-700 transition-all duration-300 transform hover:scale-105 animate-bounce-in delay-200"
          >
            <FaDiscord className="mr-3 text-3xl" />
            Entrar no Discord
          </a>
        </div>
      </section>

      {/* Contato */}
      <section id="contato" className="py-20 px-6 md:px-12 bg-gray-950 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-yellow-500 mb-6 animate-fade-in-down">Fale Conosco</h2>
          <p className="text-lg text-gray-300 mb-10 animate-fade-in-down delay-100">
            Tem dúvidas, sugestões ou quer apenas bater um papo? Não hesite em nos contatar!
          </p>

          <div className="flex flex-col md:flex-row justify-center items-center gap-6">
            <div className="relative w-full md:w-auto">
              <input
                ref={emailRef}
                type="text"
                value="contato@alfaracingbrasil.com" // <<-- SUBSTITUA PELO SEU EMAIL REAL
                readOnly
                className="w-full md:w-80 p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-500 pr-12"
              />
              <button
                onClick={handleCopyEmail}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>

            <a
              href="https://twitter.com/alfaracingbr" // <<-- SUBSTITUA PELO LINK REAL DO SEU TWITTER/X
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-all duration-300 transform hover:scale-105"
            >
              <FaTwitter className="mr-3 text-xl" />
              Twitter/X
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-8 px-6 md:px-12 text-center text-gray-400 text-sm">
        <div className="max-w-4xl mx-auto">
          <p>&copy; {new Date().getFullYear()} Alfa Racing Brasil. Todos os direitos reservados.</p>
          <p className="mt-2">Feito com paixão por GPRO.</p>
          <div className="flex justify-center space-x-4 mt-4">
            <a href="https://gpro.net/gb/gpro.asp" target="_blank" rel="noopener noreferrer" className="hover:text-yellow-500 transition-colors">GPRO Official</a>
            <span className="text-gray-600">|</span>
            <a href="#" className="hover:text-yellow-500 transition-colors">Política de Privacidade</a> {/* Crie esta página se necessário */}
          </div>
        </div>
      </footer>
    </div>
  );
}