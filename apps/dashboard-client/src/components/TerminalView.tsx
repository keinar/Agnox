import Ansi from 'ansi-to-react';

interface Props {
    output?: string;
    error?: string;
}

export const TerminalView = ({ output, error }: Props) => {
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