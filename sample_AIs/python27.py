# posting to: http://localhost:3000/api/articles/update/:articleid with title, content
# changes title, content
#
import time # for testing, this is not good
import requests # if not installed already, run python -m pip install requests OR pip install requests, whatever you normally do
r = requests.post('http://localhost:3000/api/games/search', data={'personID': 0}) # search for new game
json = r.json() # when request comes back, that means you've found a match! (validation if server goes down?)
print(json)
gameID = json['gameID']
playerID = json['playerID']
print(gameID)
print(playerID)
input = ' '
while input != '':
	input = raw_input('input move: ')
	r = requests.post('http://localhost:3000/api/games/submit/' + gameID, data={'playerID': playerID, 'move': input}); # submit sample move
	json = r.json()
	print(json)