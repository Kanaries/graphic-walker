import React from 'react';
import { HelloWorld, Button, useCounter, formatName, getGreeting } from '@lib';

const App: React.FC = () => {
  const { count, increment, decrement, reset } = useCounter();
  const currentHour = new Date().getHours();
  const greeting = getGreeting(currentHour);

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>{greeting}! 👋</h1>
      
      <section style={{ marginBottom: '30px' }}>
        <h2>HelloWorld Component</h2>
        <HelloWorld />
        <HelloWorld name={formatName("react")} color="blue" />
        <HelloWorld name="TypeScript" color="purple" />
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Button Component</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button onClick={() => alert('Primary clicked!')}>
            Primary Button
          </Button>
          <Button variant="secondary" onClick={() => alert('Secondary clicked!')}>
            Secondary Button
          </Button>
        </div>
      </section>

      <section>
        <h2>useCounter Hook</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Button onClick={decrement}>-</Button>
          <span style={{ fontSize: '24px', minWidth: '50px', textAlign: 'center' }}>
            {count}
          </span>
          <Button onClick={increment}>+</Button>
          <Button variant="secondary" onClick={reset}>Reset</Button>
        </div>
      </section>
    </div>
  );
};

export default App;