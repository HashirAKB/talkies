// Type three todos into the public TodoMVC demo.
export default async ({ page, demo, env }) => {
  await demo.skip(() => page.goto(env.baseUrl));
  const input = page.getByPlaceholder('What needs to be done?');
  await demo.pause(600);
  for (const todo of ['Write the scenes', 'Record a take', 'Ship the video']) {
    await demo.type(input, todo);
    await input.press('Enter');
    await demo.pause(250);
  }
  await demo.point(page.getByTestId('todo-item').last());
};
