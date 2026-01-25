import Ansi from 'ansi-to-react';
import { Sparkles } from 'lucide-react'; // Optional: for a "magic" icon

interface Props {
    output?: string;
    error?: string;
    analysis?: string; // Added new prop
}

export const TerminalView = ({ output, error, analysis }: Props) => {
    return (
        <div className="terminal-window">
            <div className="terminal-header">
                <div className="dot red"></div>
                <div className="dot yellow"></div>
                <div className="dot green"></div>
                <span style={{ marginLeft: '10px', fontSize: '12px', color: '#8b949e' }}>
                    console output
                </span>
            </div>
            <div className="terminal-body">
                {/* AI Analysis Section */}
                {analysis && (
                    <div className="ai-analysis-box" style={{
                        backgroundColor: 'rgba(126, 34, 206, 0.1)',
                        borderLeft: '4px solid #a855f7',
                        padding: '12px',
                        marginBottom: '15px',
                        borderRadius: '4px',
                        color: '#e9d5ff'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontWeight: 'bold' }}>
                            <Sparkles size={16} style={{ marginRight: '8px' }} />
                            AI Failure Analysis
                        </div>
                        <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>{analysis}</p>
                    </div>
                )}

                {output ? (
                    <Ansi>{output}</Ansi>
                ) : (
                    <span style={{ color: '#666' }}>Waiting for logs...</span>
                )}
                
                {error && (
                    <div style={{ marginTop: '10px', color: '#ff5f56' }}>
                        <strong>Error:</strong> {error}
                    </div>
                )}
            </div>
        </div>
    );
};