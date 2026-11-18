import { Loader2 } from 'lucide-react';

export default function SummaryReport({ data }: { data: any }) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-muted">
        <Loader2 className="animate-spin mb-4 text-accent-primary" size={32} />
        <p>Generating professional analysis report...</p>
        <p className="text-sm mt-2 opacity-70">This might take a moment.</p>
      </div>
    );
  }

  // A very basic markdown-to-html renderer for this use case
  // In a real app, use react-markdown
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('# ')) {
        return <h1 key={i} className="text-3xl font-bold mt-8 mb-4">{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={i} className="text-2xl font-semibold mt-6 mb-3 text-accent-primary">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-xl font-medium mt-4 mb-2">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('* ') || line.startsWith('- ')) {
        return <li key={i} className="ml-6 mb-2 list-disc">{line.substring(2)}</li>;
      }
      if (line.trim() === '') {
        return <br key={i} />;
      }
      
      // Handle basic bolding **text**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedLine = parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j} className="font-bold text-white">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      return <p key={i} className="mb-2 text-text-secondary leading-relaxed">{formattedLine}</p>;
    });
  };

  return (
    <div className="prose prose-invert max-w-none">
      <div className="bg-bg-tertiary rounded-xl p-6 md:p-8 border border-border-glass shadow-inner">
        {renderMarkdown(data.summary)}
      </div>
    </div>
  );
}
