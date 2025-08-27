import React from 'react';

export interface HelloWorldProps {
  name?: string;
  color?: string;
}

export const HelloWorld: React.FC<HelloWorldProps> = ({ 
  name = 'World',
  color = '#333'
}) => {
  return (
    <div style={{ color, padding: '20px', fontSize: '24px' }}>
      Hello, {name}!
    </div>
  );
};